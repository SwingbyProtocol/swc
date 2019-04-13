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
let eventLists = {}
let wshLists = []
let tokens = {}

module.exports.getWshLists = async (req, reply) => {
    try {
        const web3 = getWeb3()
        console.log(`current provider: ${web3.currentProvider.host}`)

        const params = req.params
        const query = req.query
        const body = req.body

        //await validateGet(params, query, body)

        if (!btc2eth1Instance) {
            btc2eth1Instance = new web3.eth.Contract(btc2eth1.abi, config.eth.btc2eth1.address)
            console.log('init btc2eth1', btc2eth1Instance.address)
            updateWshList()
        }

        return {
            result: true,
            wshLists: wshLists
        }


    } catch (err) {
        throw boom.boomify(err)
    }
}


const updateWshList = () => {
    btc2eth1Instance.getPastEvents('AddWshEvent', {
            filter: {}, // Using an array means OR: e.g. 20 or 23
            fromBlock: 0,
            toBlock: 'latest'
        })
        .then((events) => {
            eventLists = events
            wshLists = events.map((event) => {
                return {
                    wsh: event.returnValues.wsh,
                    own: event.returnValues.own
                }
            })
            console.log('updated wshLists count:', wshLists.length)
        });
    setTimeout(() => {
        updateWshList()
    }, 50000)
}