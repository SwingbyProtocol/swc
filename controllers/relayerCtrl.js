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

        isValidTx(web3, params, params.sig)

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
    const from = Buffer.from(params.from.slice(2), 'hex') //remove 0x
    const to = Buffer.from(params.to.slice(2), "hex")
    const amount = web3.utils.padLeft(web3.utils.numberToHex(params.amount)).slice(2)
    const inputs = [
        Buffer.from(web3.utils.padLeft(web3.utils.numberToHex(params.inputs[0])).slice(2), 'hex'),
        Buffer.from(web3.utils.padLeft(web3.utils.numberToHex(params.inputs[0])).slice(2), 'hex')
    ]
    const relayer = Buffer.from(params.relayer, "hex")
    const tokenReceiver = Buffer.from(params.tokenReceiver, "hex")
    const sig = ethUtil.fromRpcSig(params.sig);
    console.log(from, to, amount, sig)
    const prefix = new Buffer("\x19Ethereum Signed Message:\n");
    const prefixedMsg = ethUtil.sha3(
        Buffer.concat([
            prefix,
            from,
            to,
            amount, ,
            inputs[1],
            inputs[2],
            inputs[3],
            relayer,
            tokenReceiver
        ])
    );

    const pubKey = util.ecrecover(prefixedMsg, sig.v, sig.r, sig.s);
    const addrBuf = util.pubToAddress(pubKey);
    const addr = util.bufferToHex(addrBuf);

    console.log(addr);
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