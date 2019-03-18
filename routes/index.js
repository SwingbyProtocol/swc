var express = require('express');
var router = express.Router();

var bootstamp = [
  "34.73.42.191"
]
var ipfsClient = require('ipfs-http-client')

var ipfs = ipfsClient({
  host: bootstamp[0],
  port: '5001',
  protocol: 'http'
})

/* GET home page. */
router.get('/', function (req, res, next) {

  const data = {
    id: "text",
    bus: "ee"
  }
  let obj = Buffer.from(JSON.stringify(data))
  ipfs.add(obj, (err, cid) => {
    if (err) {
      console.log(err)
      throw err
    }
    console.log(cid)
    // Logs:
    // QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn
    res.send({
      cid: cid.toString()
    })
  })
});

module.exports = router;