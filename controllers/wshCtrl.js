'use strict';

const boom = require('boom')
const ethTx = require('ethereumjs-tx')
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const config = require('config')
const tokenData = require('../build/contracts/Token.json')
const callerData = require('../build/contracts/AccountCaller.json')
const btc2eth1 = require('../build/contracts/Btc2eth1.json')
const getWeb3 = require('../resolvers').api.getWeb3
const account = require('../resolvers').account()

let btc2eth1Instance
let eventLists = []
let wshLists = []
module.exports.getWshLists = async (req, reply) => {
    try {
        const web3 = getWeb3()
        console.log(`current provider: ${web3.currentProvider.host}`)

        if (!btc2eth1Instance) {
            btc2eth1Instance = new web3.eth.Contract(btc2eth1.abi, config.eth.btc2eth1.address)
            console.log('init btc2eth1', btc2eth1Instance.address)
            updateWshList()
        }
        console.log('updated eventLists count:', eventLists.length, 'wshLists', wshLists.length)

        return {
            result: true,
            wshLists: wshLists.length > 14 ? wshLists.slice(wshLists.length - 14) : wshLists
        }
    } catch (err) {
        throw boom.boomify(err)
    }
}

module.exports.getWshSingle = async (req, reply) => {
    try {
        const web3 = getWeb3()
        console.log(`current provider: ${web3.currentProvider.host}`)

        const params = req.params
        if (!params.wsh)
            throw boom.boomify(new Error("wsh is not provided"))
        if (!isHexString64With0x(params.wsh))
            throw boom.boomify(new Error("wsh is not validated"))

        if (!btc2eth1Instance) {
            btc2eth1Instance = new web3.eth.Contract(btc2eth1.abi, config.eth.btc2eth1.address)
            console.log('init btc2eth1', btc2eth1Instance.address)
            updateWshList()
        }

        const status = await btc2eth1Instance.methods.getCount(params.wsh).call()

        let msg = "NotUsed"
        if (status.toString() == "1")
            msg = "UsedByLender"
        if (status.toString() == "2")
            msg = "UsedByBoth"

        return {
            result: true,
            status: msg,
            log: status.toString()
        }
    } catch (err) {
        throw boom.boomify(err)
    }
}


function isHexString64With0x(str) {
    if (!str instanceof String) {
        return false
    }
    if (str.length !== 66) {
        return false
    }
    const regexp = /^[0-9a-fA-F]+$/;
    if (!regexp.test(str.slice(2))) {
        return false
    }
    return true
}

const updateWshList = () => {
    if (!btc2eth1Instance) {
        btc2eth1Instance = new web3.eth.Contract(btc2eth1.abi, config.eth.btc2eth1.address)
        console.log('init btc2eth1', btc2eth1Instance.address)
    }
    btc2eth1Instance.getPastEvents('AddWshEvent', {
            filter: {},
            fromBlock: 0,
            toBlock: 'latest'
        })
        .then((events) => {
            eventLists = events
            wshLists = eventLists.map((event) => {
                return {
                    wsh: event.returnValues.wsh,
                    own: event.returnValues.own
                }
            })
        });

    btc2eth1Instance.events.AddWshEvent()
        .on('data', (event) => {
            wshLists.push({
                wsh: event.returnValues.wsh,
                own: event.returnValues.own
            })
            eventLists.push({
                wsh: event.returnValues.wsh,
                own: event.returnValues.own
            })
        })
}