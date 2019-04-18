'use strict';

const boom = require('boom')
const ethTx = require('ethereumjs-tx')
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const config = require('config')
const tokenData = require('../build/contracts/Token.json')
const callerData = require('../build/contracts/AccountCaller.json')
const getWeb3 = require('../resolvers').api.getWeb3
const account = require('../resolvers').account()

let accountCaller
let txs = {}
let tokens = {}

module.exports.getMetaTx = async (req, reply) => {
    try {
        const web3 = getWeb3()
        console.log(`current provider: ${web3.currentProvider.host}`)

        const params = req.params
        const query = req.query
        const body = req.body

        await validateGet(params, query, body)

        if (!tokens[params.gasToken]) {
            tokens[params.gasToken] = new web3.eth.Contract(tokenData.abi, params.gasToken)
        }

        if (!accountCaller) {
            accountCaller = new web3.eth.Contract(callerData.abi, config.eth.accountCaller.address)
        }

        const batch = []
        batch.push(accountCaller.methods.getEstimateGasPrice(params.gasToken, account.address).call())
        batch.push(accountCaller.methods.getNonce(query.signer).call())
        batch.push(accountCaller.methods.getAccountAddress(query.signer, query.salt).call())

        let calls = await Promise.all(batch)

        return {
            result: true,
            token: {
                address: ethUtil.toChecksumAddress(params.gasToken)
            },
            signer: {
                address: query.signer,
                wallet: ethUtil.toChecksumAddress(calls[2].toString()),
                nextNonce: '0x' + new BN(calls[1].toString()).toArrayLike(Buffer, 'be', 32).toString("hex")
            },
            relayer: {
                address: account.address,
                gasPrice: '0x' + new BN(calls[0].toString()).toArrayLike(Buffer, 'be', 32).toString('hex'),
                safeTxGas: '0x' + new BN(config.relayer.safeTxGas).toArrayLike(Buffer, 'be', 32).toString('hex')
            },
            accountCaller: {
                address: accountCaller.address
            }
        }

    } catch (err) {
        throw boom.boomify(err)
    }
}

module.exports.postMetaTx = async (req, reply) => {
    try {
        const web3 = getWeb3()

        console.log(`current provider: ${web3.currentProvider.host}`)

        const params = req.params
        const body = req.body

        await validatePost(params, body)

        if (!tokens[params.gasToken]) {
            tokens[params.gasToken] = new web3.eth.Contract(tokenData.abi, params.gasToken)
        }

        if (!accountCaller) {
            accountCaller = new web3.eth.Contract(callerData.abi, config.eth.accountCaller.address)
        }

        const func = accountCaller.methods.callWithDeploy(
            body.signer,
            body.salt,
            body.to,
            body.value,
            body.data,
            body.nonce,
            params.gasToken,
            body.gasPrice,
            body.safeTxGas,
            body.sig
        )
        const safeTxGas = new BN(Buffer.from(body.safeTxGas.slice(2), 'hex'))
        const gasLimit = '0x' + new BN("80000").add(safeTxGas).toString('hex')
        const gasPrice = '0x' + new BN(config.relayer.gasPrice).toString('hex')

        const batch = []
        batch.push(accountCaller.methods.getNonce(body.signer).call())
        batch.push(web3.eth.getTransactionCount(account.address))

        const calls = await Promise.all(batch)

        const expected = new BN(calls[0].toString())

        const bnNonce = new BN(Buffer.from(body.nonce.slice(2), 'hex'))
        if (!expected.eq(bnNonce))
            throw boom.boomify(new Error(`nonce is not correct expected: ${expected.toString()}`))

        const txParams = {
            nonce: '0x' + calls[1].toString(16),
            gasPrice: gasPrice,
            gasLimit: gasLimit,
            from: account.address,
            to: accountCaller.address,
            data: func.encodeABI(),
            chainId: process.env.NODE_ENV === 'mainnet' ? 0 : 5
        };

        const tx = new ethTx(txParams);
        tx.sign(account.privkey);

        const serializedTx = '0x' + tx.serialize().toString('hex')

        if (txs[serializedTx]) {
            throw boom.boomify(new Error("tx is already sent"))
        }

        const txHash = await handleSend(web3, serializedTx)

        txs[serializedTx] = txHash

        return {
            result: true,
            tx: serializedTx,
            txHash: txHash
        }

    } catch (err) {
        throw boom.boomify(err)
    }
}


function handleSend(web3, serializedTx) {
    return new Promise((resolve, reject) => {
        web3.eth.sendSignedTransaction(serializedTx)
            .on('transactionHash', (txHash) => {
                resolve(txHash)
            })
            .on('error', function (err) {
                reject(err)
            })
            .on('confirmation', function (confirmationNumber, receipt) {
                if (confirmationNumber <= 5)
                    console.log(confirmationNumber, receipt.transactionHash)
            })
    })
}

function validateGet(params, query, body) {
    return new Promise((resolve, reject) => {
        if (!isValidConfig())
            reject(new Error("config is wrong"))
        if (!isValidToken(params))
            reject(new Error("token validation error"))
        if (!isValidQuery(query))
            reject(new Error('query is wrong'))
        resolve(true)
    })
}

function validatePost(params, body) {
    return new Promise((resolve, reject) => {
        if (!isValidConfig())
            reject(new Error("config is wrong"))
        if (!isValidToken(params))
            reject(new Error("token validation error"))
        if (!sanitize(body))
            reject(new Error("sanitize error"))
        if (!isValidMetaTx(params, body))
            reject(new Error("valid tx error"))

        resolve(true)
    })
}


function isValidConfig() {
    if (!config.relayer.safeTxGas)
        return false
    if (!config.relayer.gasPrice)
        return false
    if (!config.eth.accountCaller.address)
        return false
    if (!config.eth.tokens)
        return false
    if (!isStringInteger(config.relayer.safeTxGas))
        return false
    if (!isStringInteger(config.relayer.gasPrice))
        return false
    if (!isAddress(config.eth.accountCaller.address))
        return false
    if (!config.eth.tokens.length === 0)
        return false
    return true
}

function isValidToken(params) {
    if (!params.gasToken)
        return false;
    if (!isAddress(params.gasToken))
        return false;
    const buf = Buffer.from(params.gasToken.slice(2), 'hex')
    if (config.eth.tokens.filter((t) => {
            return (Buffer.from(t.address.slice(2), 'hex').toString('hex') === buf.toString('hex'))
        }).length === 0) {
        return false
    }
    return true
}

function isValidQuery(query) {
    if (!query.signer)
        return false
    if (!query.salt)
        return false
    if (!isAddress(query.signer))
        return false
    if (!isHex(query.salt, 66))
        return false
    return true
}

function addressHex2WithPadding(addressHex) {
    return ethUtil.setLengthLeft(Buffer.from(addressHex.slice(2), 'hex'), 32)
}

function isValidMetaTx(params, body) {

    const _signer = addressHex2WithPadding(body.signer)
    const _salt = Buffer.from(body.salt.slice(2), 'hex')
    const _to = addressHex2WithPadding(body.to)
    const _value = Buffer.from(body.value.slice(2), 'hex')
    const _data = Buffer.from(body.data.slice(2), 'hex')
    const _nonce = Buffer.from(body.nonce.slice(2), "hex")
    const _gasToken = addressHex2WithPadding(params.gasToken)
    const _gasPrice = Buffer.from(body.gasPrice.slice(2), "hex")
    const _safeTxGas = Buffer.from(body.safeTxGas.slice(2), "hex")

    console.log(_signer.toString('hex'))
    console.log(_salt.toString('hex'))
    console.log(_to.toString('hex'))
    console.log(_value.toString('hex'))
    console.log(_data.toString('hex'))
    console.log(_nonce.toString('hex'))
    console.log(_gasToken.toString('hex'))
    console.log(_gasPrice.toString('hex'))
    console.log(_safeTxGas.toString('hex'))

    if (config.relayer.gasPrice !== new BN(_gasPrice).toString())
        return false
    if (config.relayer.safeTxGas !== new BN(_safeTxGas).toString())
        return false
    const domainSeparator = "0x6dfab631337b71bb9063478db697317b7da12ec65d07ba88a1180284d045a5ca"

    const hash = ethUtil.keccak256(
        Buffer.concat([
            Buffer.from('\x19\x01'),
            Buffer.from(domainSeparator.slice(2), 'hex'),
            ethUtil.keccak256(
                Buffer.concat([
                    _signer,
                    _salt,
                    _to,
                    _value,
                    ethUtil.keccak256(_data),
                    _nonce,
                    _gasToken,
                    _gasPrice,
                    _safeTxGas
                ]))
        ]))

    let rsv = Buffer.from(body.sig.slice(2), 'hex')
    const r = rsv.slice(0, 32)
    const s = rsv.slice(32, 64)
    const v = new BN(rsv.slice(64, body.sig.length - 2)).toNumber()

    console.log("r", r.toString('hex'), "s", s.toString('hex'), "v", v, "hash", hash.toString('hex'))

    const pubKey = ethUtil.ecrecover(hash, v, r, s);
    const addr = ethUtil.publicToAddress(pubKey)

    if (ethUtil.toChecksumAddress(body.signer) === ethUtil.toChecksumAddress(addr.toString('hex'))) {
        return true
    }
    return false
}

function sanitize(body) {
    if (!body.signer)
        return false
    if (!body.salt)
        return false
    if (!body.to)
        return false
    if (!body.value)
        return false
    if (!body.data)
        return false
    if (!body.nonce)
        return false
    if (!body.gasPrice)
        return false
    if (!body.safeTxGas)
        return false
    if (!body.sig)
        return false
    if (!isAddress(body.signer))
        return false
    if (!isHex(body.salt, 66))
        return false
    if (!isAddress(body.to))
        return false
    if (!isHex(body.value, 66))
        return false
    if (!isHex(body.data))
        return false
    if (!isHex(body.nonce, 66))
        return false
    if (!isHex(body.gasPrice, 66))
        return false
    if (!isHex(body.safeTxGas, 66))
        return false
    if (!isHex(body.sig))
        return false
    return true
}


function isHex(str, length) {
    if (!str instanceof String) {
        return false
    }
    if (str.length <= 2) {
        return false
    }
    if (str.length !== length && length > 1)
        return false
    const regexp = /^[0-9a-fA-F]+$/;
    if (!regexp.test(str.slice(2))) {
        return false
    }
    return true
}

function isAddress(str) {
    if (!str instanceof String) {
        return false
    }
    if (ethUtil.isValidAddress(str)) {
        return true;
    }
    if (ethUtil.isValidChecksumAddress(str)) {
        return true;
    }
    return false;
}

function isStringInteger(str) {
    return /^\+?(0|[1-9]\d*)$/.test(str);
}

function isValidArray(inputs, length, type) {
    if (!inputs instanceof Array) {
        return false
    }
    if (inputs.length !== length) {
        return false
    }
    if (inputs.filter((v) => {
            switch (type) {
                case "hexstring":
                    return !isHex(v)
                default:
                    return !isStringInteger(v)
            }
        }).length !== 0) {
        return false
    }
    return true
}