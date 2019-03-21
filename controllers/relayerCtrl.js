'use strict';

const boom = require('boom')
const ethUtil = require('ethereumjs-util')
const config = require('config')
const Tx = require('ethereumjs-tx')
const BN = require('bn.js')
const TokenContract = require('../build/contracts/Token.json')
const tokenAbi = TokenContract.abi
const ethConf = config.get("eth")
const userConf = config.get("user")
// Get Data Models
const getWeb3 = require('../resolver').getWeb3
const getIPFS = require('../resolver').getIPFSs

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
const sender = "0x" + ethUtil.privateToAddress(privkey).toString('hex')
ethConf.tokens.forEach(t => {
    console.log(`supported Tokens = ${t.name} address: ${t.address}`)
});
console.log(`relayer == ${sender}`)

module.exports.getMetaTx = async (req, reply) => {
    try {
        const web3 = getWeb3()

        const params = req.params
        const body = req.body
        const success = await validateGet(params, body)

        const tokenAddress = req.params.tokenAddress
        const token = new web3.eth.Contract(tokenAbi, tokenAddress)

        const tokenPrice = await token.methods.getEstimateTokenPrice(sender).call()

        return {
            result: true,
            relayer: {
                gasPrice: userConf.gasPrice,
                gasLimit: userConf.gasLimit,
                tokenPrice: tokenPrice.toString()
            }
        }

    } catch (err) {
        throw boom.boomify(err)
    }
}

module.exports.postMetaTx = async (req, reply) => {
    try {
        const web3 = getWeb3()

        const params = req.params
        const body = req.body

        await validatePost(params, body)

        const tokenAddress = params.tokenAddress

        const token = new web3.eth.Contract(tokenAbi, tokenAddress)

        const func = await token.methods.transferMetaTx(
            body.from,
            body.to,
            body.amount,
            [body.inputs[0], body.inputs[1], body.inputs[2], body.inputs[3]],
            [body.providers[0], body.providers[1]],
            body.v,
            body.r,
            body.s
        )

        const estimateGas = await func.estimateGas({
            from: body.providers[0],
            gasPrice: ethUtil.bufferToHex(new BN(body.inputs[0]).toBuffer()),
            gasLimit: ethUtil.bufferToHex(new BN("476000").sub(new BN(body.inputs[1])).toBuffer()),
        })
        console.log("estimateGas => ", estimateGas)

        const nonce = await web3.eth.getTransactionCount(body.providers[0])

        const txParams = {
            nonce: '0x' + nonce.toString(16),
            gasPrice: ethUtil.bufferToHex(new BN(body.inputs[0]).toBuffer()),
            gasLimit: ethUtil.bufferToHex(new BN("476000").sub(new BN(body.inputs[1])).toBuffer()),
            from: body.providers[0],
            to: tokenAddress,
            data: func.encodeABI()
        };

        var tx = new Tx(txParams);
        tx.sign(privkey);

        const serializedTx = '0x' + tx.serialize().toString('hex')

        web3.eth.sendSignedTransaction(serializedTx).then((res) => {
            console.log("res => ", res)
        }).catch((err) => {
            console.log("Error: Transaction has been reverted by the EVM:")
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

function validateGet(params, body) {
    if (!isValidToken(params))
        return {
            result: false,
            message: "token validation error"
        }
    return true
}

function validatePost(params, body) {
    return new Promise((resolve, reject) => {
        if (!isValidToken(params))
            reject(new Error("token validation error"))
        if (!sanitize(body))
            reject(new Error("sanitize error"))
        if (!isValidMetaTx(body))
            reject(new Error("valid tx error"))
        if (!isValidRelayer(body.providers[0], privkey))
            reject(new Error("sender is not relayer"))
        if (!isValidUserConfig(body))
            reject(new Error("config is wrong"))
        resolve(true)
    })
}


function isValidUserConfig(body) {
    if (!userConf.gasPrice)
        return false
    if (!userConf.gasLimit)
        return false
    if (!isStringInteger(userConf.gasPrice))
        return false
    if (!isStringInteger(userConf.gasLimit))
        return false
    if (userConf.gasPrice !== body.inputs[0])
        return false
    if (userConf.gasLimit !== body.inputs[1])
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
    const sender = ethUtil.privateToAddress(privkey)
    if (Buffer.from(relayer.slice(2), 'hex').toString('hex') !== sender.toString('hex')) {
        return false
    }
    return true;
}

function isValidMetaTx(body) {
    const from = Buffer.from(body.from.slice(2), 'hex')
    const to = Buffer.from(body.to.slice(2), "hex")
    const amount = Buffer.from(num2hex32(body.amount), 'hex')
    const inputs = [
        Buffer.from(num2hex32(body.inputs[0]), 'hex'),
        Buffer.from(num2hex32(body.inputs[1]), 'hex'),
        Buffer.from(num2hex32(body.inputs[2]), 'hex'),
        Buffer.from(num2hex32(body.inputs[3]), 'hex')
    ]
    const providers = [
        Buffer.from(body.providers[0].slice(2), 'hex'),
        Buffer.from(body.providers[1].slice(2), 'hex')
    ]

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
            providers[0],
            providers[1]
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
    if (!body.providers)
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
    if (!isValidArray(body.providers, 2, "hexstring"))
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