// External Dependancies
const boom = require('boom')
const ethUtil = require('ethereumjs-util')

// Get Data Models
const getWeb3 = require('../resolver').getWeb3
const getIPFS = require('../resolver').getIPFSs

const SWINGBY_TX_TYPEHASH = "0x199aa146523304760a88092ee1dd338a68f10185375827f1e838ab5e9bd1622b"

module.exports.postMetaTx = async (req, reply) => {
    try {
        const web3 = getWeb3()

        const params = req.body

        console.log(params)

        if (!sanitize(params)) {
            return {
                result: false,
                message: "sanitize error"
            }
        }

        if (!isValidTx(web3, params, params.sig)) {
            return {
                result: false,
                message: "sanitize error"
            }
        }

        const send = await web3.eth.sendRawTransaction()

        const data = {
            data: "test",
            txHash: latest
        }
        return data
    } catch (err) {
        throw boom.boomify(err)
    }
}

function isValidTx(web3, params) {
    const from = Buffer.from(params.from.slice(2), 'hex')
    const to = Buffer.from(params.to.slice(2), "hex")
    const amount = Buffer.from(num2hex64(web3, params.amount), 'hex')
    const inputs = [
        Buffer.from(num2hex64(web3, params.inputs[0]), 'hex'),
        Buffer.from(num2hex64(web3, params.inputs[1]), 'hex'),
        Buffer.from(num2hex64(web3, params.inputs[2]), 'hex'),
        Buffer.from(num2hex64(web3, params.inputs[3]), 'hex')
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
    regexp = /^[0-9a-fA-F]+$/;
    if (regexp.test(str.slice(2))) {
        return true
    } else {
        return false
    }
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

function num2hex64(web3, bn) {
    return web3.utils.padLeft(web3.utils.numberToHex(bn), 64).slice(2)
}

function address2hex64(web3, address) {
    return web3.utils.padLeft(address, 64).slice(2) //remove 0x
}

/**
 * if (!sanitize(params)) {
    return res.status(500).send({
      result: false,
      message: "sanitize error"
    })
  }

  

  res.send('respond with a resource');
});

function sanitize(params) {
  if (!params.from)
    return false
  if (!isHex(params.from))
    return false
  if (!params.to)
    return false
  if (!isHex(params.to))
    return false
  return true
}

function isHex(str) {

  regexp = /^[0-9a-fA-F]+$/;
  if (regexp.test(str)) {
    return true
  } else {
    return false
  }
}

 */