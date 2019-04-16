'use strict';

const ethUtil = require('ethereumjs-util')
const config = require('config')
const ethConf = config.get("eth")

if (process.env.NODE_ENV == "testnet") {
    console.log(`network = web3 : goerli, btc : testnet3`)
} else {
    console.log(`network = web3 : localhost, btc : localhost`)
}
const privkey = new Buffer.from(process.env.KEY.slice(2), 'hex')
const sender = ethUtil.toChecksumAddress("0x" + ethUtil.privateToAddress(privkey).toString('hex'))
ethConf.tokens.forEach(t => {
    console.log(`supported Tokens = ${t.name} address: ${t.address}`)
})
console.log(`owner == ${sender} caller == ${ethConf.accountCaller.address}`)

const getAccount = () => {
    return {
        address: sender,
        privkey: privkey
    }
}

module.exports = getAccount