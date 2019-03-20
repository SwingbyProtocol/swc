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
                message: "sanitize error"
            }
        }

        if (!isHex(process.env.KEY)) {
            return {
                result: false,
                message: "relayer key error"
            } 
        }

        const privkey = new Buffer.from(process.env.KEY.slice(2), 'hex')

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

        const data = token.methods.transferMetaTx(
            params.from,
            params.to,
            params.amount,
            params.inputs,
            params.relayer,
            params.tokenReceiver,
            params.sig
        ).encodeABI()

        const txData = {
            nonce: ethUtil.bufferToHex(new BN(nonce).toBuffer()),
            gasLimit: ethUtil.bufferToHex(new BN(params.inputs[1]).add(new BN('80000')).toBuffer()),
            gasPrice: ethUtil.bufferToHex(new BN(params.inputs[0]).toBuffer()), // 10 Gwei
            to: tokenAddress,
            from: params.relayer,
            value: 0,
            data: data
        }

        console.log(txData)

        var tx = new Tx(txData);
        tx.sign(privkey);

        const serializedTx = tx.serialize().toString('hex')
        const send = await web3.eth.sendSignedTransaction('0x' + serializedTx)

        return {
            result: true,
            tx: send
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
    regexp = /^[0-9a-fA-F]+$/;
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