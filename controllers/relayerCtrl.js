'use strict';

const boom = require('boom')
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const config = require('config')
const Tx = require('ethereumjs-tx')
const TokenContract = require('../build/contracts/Token.json')
const tokenAbi = TokenContract.abi
const ethConf = config.get("eth")
const relayerConf = config.get("relayer")
// Get Data Models
const getWeb3 = require('../resolvers').api.getWeb3
//const getIPFS = require('../resolver').getIPFSs

const SWINGBY_TX_TYPEHASH = "0x199aa146523304760a88092ee1dd338a68f10185375827f1e838ab5e9bd1622b"

if (process.env.NODE_ENV == "testnet") {
    console.log(`network = web3 : ropsten, btc : testnet3`)
} else {
    console.log(`network = web3 : localhost, btc : localhost`)
}

if (!isHex(process.env.KEY)) {
    throw boom.boomify(new Error('privkey is not provided'))
}
const privkey = new Buffer.from(process.env.KEY.slice(2), 'hex')
const sender = ethUtil.toChecksumAddress("0x" + ethUtil.privateToAddress(privkey).toString('hex'))
ethConf.tokens.forEach(t => {
    console.log(`supported Tokens = ${t.name} address: ${t.address}`)
});
let txs = {}
let tokens = {}
let estimateGas = 0

console.log(`relayer == ${sender}`)

module.exports.getMetaTx = async (req, reply) => {
    try {
        const web3 = getWeb3()

        const params = req.params
        const query = req.query
        const body = req.body

        if (!query.signer) {
            throw boom.boomify(new Error("signer is not set"))
        }

        if (!isHex(query.signer)) {
            throw boom.boomify(new Error("signer is not hexstring"))
        }

        await validateGet(params, body)

        const tokenAddress = "0x" + Buffer.from(req.params.tokenAddress.slice(2), 'hex').toString('hex')

        const tokenReceiver = "0x" + Buffer.from(relayerConf.tokenReceiver.slice(2), 'hex').toString('hex')

        if (!tokens[tokenAddress]) {
            tokens[tokenAddress] = new web3.eth.Contract(tokenAbi, tokenAddress)
        }

        const batch = []
        batch.push(tokens[tokenAddress].methods.getEstimateTokenPrice(sender).call())
        batch.push(tokens[tokenAddress].methods.getNonce(query.signer).call())
        batch.push(tokens[tokenAddress].methods.balanceOf(query.signer).call())

        let calls = await Promise.all(batch)

        const expected = new BN(calls[1].toString()).add(new BN('1')) // BigNumber not BN

        return {
            result: true,
            token: {
                address: ethUtil.toChecksumAddress(tokenAddress)
            },
            signer: {
                address: query.signer,
                nextNonce: expected.toString(),
                latestBalance: new BN(calls[2].toString()).toString(),
            },
            relayer: {
                address: sender,
                tokenReceiver: ethUtil.toChecksumAddress(tokenReceiver),
                gasPrice: relayerConf.gasPrice,
                gasLimit: relayerConf.gasLimit,
                tokenPrice: new BN(calls[0].toString()).toString()
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

        //console.log(relayerBalanceWei)

        const params = req.params
        const body = req.body

        await validatePost(params, body)

        const tokenAddress = params.tokenAddress

        const tokenReceiver = "0x" + Buffer.from(relayerConf.tokenReceiver.slice(2), 'hex').toString('hex')

        if (!tokens[tokenAddress]) {
            tokens[tokenAddress] = new web3.eth.Contract(tokenAbi, tokenAddress)
        }

        const func = await tokens[tokenAddress].methods.transferMetaTx(
            body.from,
            body.to,
            body.amount,
            [...body.inputs],
            body.relayer,
            body.v,
            body.r,
            body.s,
            ethUtil.toChecksumAddress(tokenReceiver)
        )

        if (!estimateGas)
            estimateGas = await func.estimateGas({
                from: body.relayer,
                gasPrice: ethUtil.bufferToHex(new BN(body.inputs[0]).toBuffer()),
                gasLimit: ethUtil.bufferToHex(new BN("80000").add(new BN(body.inputs[1])).toBuffer()),
            })

        console.log("estimateGas => ", estimateGas)

        const batch = []
        batch.push(web3.eth.getBalance(body.relayer))
        batch.push(tokens[tokenAddress].methods.getNonce(body.from).call())
        batch.push(web3.eth.getTransactionCount(body.relayer))

        const calls = await Promise.all(batch)

        // gas * gasPrice
        if (new BN(estimateGas.toString()).mul(new BN(body.inputs[0])).gt(new BN(calls[0].toString())))
            throw boom.boomify(new Error("relayer hasn't enough balance of ether"))

        const expected = new BN(calls[1].toString()).add(new BN("1"))

        if (!expected.eq(new BN(body.inputs[3])))
            throw boom.boomify(new Error(`nonce is not correct expected: ${expected}`))

        const txParams = {
            nonce: '0x' + calls[2].toString(16),
            gasPrice: ethUtil.bufferToHex(new BN(body.inputs[0]).toBuffer()),
            gasLimit: ethUtil.bufferToHex(new BN("80000").add(new BN(body.inputs[1])).toBuffer()),
            from: body.relayer,
            to: tokenAddress,
            data: func.encodeABI(),
            chainId: process.env.NODE_ENV === 'mainnet' ? 0 : 5
        };

        var tx = new Tx(txParams);
        tx.sign(privkey);

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
                console.log(confirmationNumber, receipt)
            })
    })
}

function validateGet(params, body) {
    return new Promise((resolve, reject) => {
        if (!isValidConfig())
            reject(new Error("config is wrong"))
        if (!isValidToken(params))
            reject(new Error("token validation error"))

        resolve(true)
    })
}

function validatePost(params, body) {
    return new Promise((resolve, reject) => {
        if (!isValidConfig(body))
            reject(new Error("config is wrong"))
        if (!isValidToken(params))
            reject(new Error("token validation error"))
        if (!sanitize(body))
            reject(new Error("sanitize error"))
        if (!isValidRelayer(body.relayer, privkey))
            reject(new Error("sender or tokenReceiver is not relayer"))
        if (!isValidMetaTx(body))
            reject(new Error("valid tx error"))

        resolve(true)
    })
}


function isValidConfig() {
    if (!relayerConf.gasPrice)
        return false
    if (!relayerConf.gasLimit)
        return false
    if (!ethConf.tokens)
        return false
    if (!relayerConf.tokenReceiver)
        return false
    if (!isStringInteger(relayerConf.gasPrice))
        return false
    if (!isStringInteger(relayerConf.gasLimit))
        return false
    if (!ethConf.tokens instanceof Array)
        return false
    if (!isHex(relayerConf.tokenReceiver))
        return false
    return true
}

function isValidToken(params) {
    if (!params.tokenAddress)
        return false;
    if (!isHex(params.tokenAddress))
        return false;
    const buf = Buffer.from(params.tokenAddress.slice(2), 'hex')
    if (ethConf.tokens.filter((t) => {
            return (Buffer.from(t.address.slice(2), 'hex').toString('hex') === buf.toString('hex'))
        }).length === 0) {
        return false
    }
    return true
}

function isValidRelayer(relayer, privkey) {

    const sender = ethUtil.privateToAddress(privkey).toString('hex')
    if (Buffer.from(relayer.slice(2), 'hex').toString('hex') !== sender) {
        return false
    }
    return true;
}

function isValidMetaTx(body) {

    if (relayerConf.gasPrice !== body.inputs[0])
        return false
    if (relayerConf.gasLimit !== body.inputs[1])
        return false
    const from = Buffer.from(body.from.slice(2), 'hex')
    const to = Buffer.from(body.to.slice(2), "hex")
    const amount = Buffer.from(num2hex32(body.amount), 'hex')
    const inputs = [
        Buffer.from(num2hex32(body.inputs[0]), 'hex'),
        Buffer.from(num2hex32(body.inputs[1]), 'hex'),
        Buffer.from(num2hex32(body.inputs[2]), 'hex'),
        Buffer.from(num2hex32(body.inputs[3]), 'hex')
    ]
    const relayer = Buffer.from(body.relayer.slice(2), 'hex')

    const v = Number(body.v)
    const r = Buffer.from(body.r.slice(2), 'hex')
    const s = Buffer.from(body.s.slice(2), 'hex')

    const prefix = new Buffer.from("\x19Ethereum Signed Message:\n32", 'utf-8');

    const msg = ethUtil.keccak256(
        Buffer.concat([
            Buffer.from(SWINGBY_TX_TYPEHASH.slice(2), 'hex'),
            from,
            to,
            amount,
            inputs[0],
            inputs[1],
            inputs[2],
            inputs[3],
            relayer
        ])
    );
    const hash = ethUtil.keccak256(Buffer.concat([prefix, msg]))

    const pubKey = ethUtil.ecrecover(hash, v, r, s);
    const addrBuf = ethUtil.pubToAddress(pubKey);
    const addr = ethUtil.bufferToHex(addrBuf);

    if (from.toString('hex') === addr.slice(2)) {
        return true
    }
    return false
}

function sanitize(body) {
    if (!body.from)
        return false
    if (!body.to)
        return false
    if (!body.amount)
        return false
    if (!body.inputs)
        return false
    if (!body.relayer)
        return false
    if (!body.v)
        return false
    if (!body.r)
        return false
    if (!body.s)
        return false
    if (!isHex(body.from))
        return false
    if (!isHex(body.to))
        return false
    if (!isStringInteger(body.amount))
        return false
    if (!isValidArray(body.inputs, 4))
        return false
    if (!isHex(body.relayer))
        return false
    if (!isStringInteger(body.v))
        return false
    if (!isHex(body.r))
        return false
    if (!isHex(body.s))
        return false
    return true
}


function isHex(str) {
    if (!str instanceof String) {
        return false
    }
    if (str.length <= 2) {
        return false
    }
    const regexp = /^[0-9a-fA-F]+$/;
    if (!regexp.test(str.slice(2))) {
        return false
    }
    return true
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

function num2hex32(stringNum) {
    return ethUtil.setLengthLeft(new BN(stringNum).toBuffer(), 32).toString('hex')
}