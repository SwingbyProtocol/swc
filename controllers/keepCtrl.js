// External Dependancies
const boom = require('boom')

// Get Data Models
//const resolver = require('../resolver')

//const web3 = resolver.getWeb3()

module.exports.postMetaTx = async (req, reply) => {
    try {
        const latest = await web3.eth.getBlock("latest")
        const data = {
            data: "test",
            latest: latest
        }
        return data
    } catch (err) {
        throw boom.boomify(err)
    }
}

/**
 * if (!sanitize(params)) {
    return res.status(500).send({
      result: false,
      message: "sanitize error"
    })
  }

  const from = Buffer.from(params.from, 'hex')
  const to = Buffer.from(params.to, "hex")
  const amount = Buffer.from(params.amount, "Hex")
  const inputs = params.inputs.filter((m) => Buffer.from(im, "hex"))
  const relayer = Buffer.from(params.relayer, "hex")
  const tokenReceiver = Buffer.from(params.tokenReceiver, "hex")
  const sig = ethUtil.fromRpcSig(params.sig);

  const prefix = new Buffer("\x19Ethereum Signed Message:\n");
  const prefixedMsg = ethUtil.sha3(
    Buffer.concat([
      prefix,
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

  const pubKey = util.ecrecover(prefixedMsg, sig.v, sig.r, sig.s);
  const addrBuf = util.pubToAddress(pubKey);
  const addr = util.bufferToHex(addrBuf);

  console.log(addr);

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