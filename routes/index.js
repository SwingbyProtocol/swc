var express = require('express');
var router = express.Router();


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