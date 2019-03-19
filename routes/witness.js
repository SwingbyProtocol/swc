let express = require('express');
let router = express.Router();
let ethUtil = require('ethereumjs-util')

/* POST join listing. */
router.post('/', function (req, res, next) {

  const params = req.body.params

  return res.send("tes")

  if (!sanitize(params)) {
    return res.send({
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

  const pubKey = util.ecrecover(prefixedMsg, res.v, res.r, res.s);
  const addrBuf = util.pubToAddress(pubKey);
  const addr = util.bufferToHex(addrBuf);

  console.log(addr);

  res.send('respond with a resource');
});


function sanitize(params) {
  if (!isHex(params.from))
    return false
  if (!isHex(params.to))
    return false
  if (!isHex(params.amount))
    return false
}

function isHex(str) {
  regexp = /^[0-9a-fA-F]+$/;
  if (regexp.test(str)) {
    return true
  } else {
    return false;
  }
}


module.exports = router;