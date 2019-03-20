'use strict';

const boom = require('boom')
const ethUtil = require('ethereumjs-util')
const config = require('config')
const Tx = require('ethereumjs-tx')
const BN = require('bn.js')
const TokenContract = require('../build/contracts/Token.json')

// Get Data Models
const getWeb3 = require('../resolver').getWeb3
const getIPFS = require('../resolver').getIPFSs

const SWINGBY_TX_TYPEHASH = "0x199aa146523304760a88092ee1dd338a68f10185375827f1e838ab5e9bd1622b"

if (!isHex(process.env.KEY)) {
    throw boom.boomify(new Error('privkey is not provided'))
}
const privkey = new Buffer.from(process.env.KEY.slice(2), 'hex')
console.log(`relayer == 0x${ethUtil.privateToAddress(privkey).toString('hex')}`)

module.exports.postMetaTx = async (req, reply) => {
    try {
        if (!isValidToken(req)) {
            return {
                result: false,
                message: "token validation error"
            }
        }

        const tokenAddress = req.params.tokenAddress

        const params = req.body

        if (!sanitize(params)) {
            return {
                result: false,
                message: "sanitize error"
            }
        }


        if (!isValidMetaTx(params)) {
            return {
                result: false,
                message: "valid tx error"
            }
        }

        if (!isHex(process.env.KEY)) {
            return {
                result: false,
                message: "relayer key error"
            }
        }


        if (!isValidRelayer(params.relayer, privkey)) {
            return {
                result: false,
                message: "sender is not relayer"
            }
        }

        const web3 = getWeb3()

        const nonce = await web3.eth.getTransactionCount(params.relayer)

        const tokenAbi = TokenContract.abi

        const token = new web3.eth.Contract(tokenAbi, tokenAddress)

        const func = token.methods.transferMetaTx(
            params.from,
            params.to,
            params.amount,
            [params.inputs[0], params.inputs[1], params.inputs[2], params.inputs[3]],
            params.relayer,
            params.tokenReceiver,
            params.sig
        )

        const estimateGas = await func.estimateGas({
            from: params.relayer,
            gasPrice: ethUtil.bufferToHex(new BN(params.inputs[0]).toBuffer()),
            gasLimit: ethUtil.bufferToHex(new BN("480000").sub(new BN(params.inputs[1])).toBuffer()),
        })
        console.log(estimateGas)

        const txParams = {
            nonce: '0x' + nonce.toString(16),
            gasPrice: ethUtil.bufferToHex(new BN(params.inputs[0]).toBuffer()),
            gasLimit: ethUtil.bufferToHex(new BN("480000").sub(new BN(params.inputs[1])).toBuffer()),
            from: params.relayer,
            to: tokenAddress,
            data: func.encodeABI()
        };

        var tx = new Tx(txParams);
        tx.sign(privkey);

        const serializedTx = '0x' + tx.serialize().toString('hex')

        web3.eth.sendSignedTransaction(serializedTx).once('transactionHash', async hash => {
            console.log(hash)
        }).catch((err) => {
            console.log(err)
        })
        const txHash = await web3.utils.sha3(serializedTx);

        return {
            result: true,
            tx: serializedTx,
            txHash: txHash
        }

    } catch (err) {
        throw boom.boomify(err)
    }
}

function isValidToken(req) {
    if (!req.params.tokenAddress)
        return false;
    if (!isHex(req.params.tokenAddress))
        return false;
    const buf = Buffer.from(req.params.tokenAddress.slice(2), 'hex')
    const tokens = config.get("eth.tokens")
    if (tokens.filter((t) => {
            return (Buffer.from(t.address.slice(2), 'hex').toString('hex') === buf.toString('hex'))
        }).length === 0) {
        return false
    }
    return true
}

function isValidRelayer(relayer, privkey) {
    const sender = ethUtil.privateToAddress(privkey)
    if (Buffer.from(relayer.slice(2), 'hex').toString('hex') !== sender.toString('hex')) {
        return false
    }
    return true;
}

function isValidMetaTx(params) {
    const from = Buffer.from(params.from.slice(2), 'hex')
    const to = Buffer.from(params.to.slice(2), "hex")
    const amount = Buffer.from(num2hex32(params.amount), 'hex')
    const inputs = [
        Buffer.from(num2hex32(params.inputs[0]), 'hex'),
        Buffer.from(num2hex32(params.inputs[1]), 'hex'),
        Buffer.from(num2hex32(params.inputs[2]), 'hex'),
        Buffer.from(num2hex32(params.inputs[3]), 'hex')
    ]
    const relayer = Buffer.from(params.relayer.slice(2), 'hex')
    const tokenReceiver = Buffer.from(params.tokenReceiver.slice(2), 'hex')
    const sig = ethUtil.fromRpcSig(params.sig);

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
            relayer,
            tokenReceiver
        ])
    );
    const hash = ethUtil.keccak256(Buffer.concat([prefix, msg]))

    const pubKey = ethUtil.ecrecover(hash, sig.v, sig.r, sig.s);
    const addrBuf = ethUtil.pubToAddress(pubKey);
    const addr = ethUtil.bufferToHex(addrBuf);

    if (from.toString('hex') === addr.slice(2)) {
        console.log('validated signature')
        return true
    }
    return false
}

function sanitize(params) {
    if (!params.from)
        return false
    if (!params.to)
        return false
    if (!params.amount)
        return false
    if (!params.inputs)
        return false
    if (!params.relayer)
        return false
    if (!params.tokenReceiver)
        return false
    if (!isHex(params.from))
        return false
    if (!isHex(params.to))
        return false
    if (!isNormalInteger(params.amount))
        return false
    if (!isValidArray(params.inputs))
        return false
    if (!isHex(params.relayer))
        return false
    if (!isHex(params.tokenReceiver))
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

function isNormalInteger(str) {
    return /^\+?(0|[1-9]\d*)$/.test(str);
}

function isValidArray(inputs) {
    if (!inputs instanceof Array) {
        return false
    }
    if (inputs.length !== 4) {
        return false
    }
    if (inputs.filter((v) => {
            return !isNormalInteger(v)
        }).length !== 0) {
        return false
    }
    return true
}

function num2hex32(stringNum) {
    return ethUtil.setLengthLeft(new BN(stringNum).toBuffer(), 32).toString('hex')
}