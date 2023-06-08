/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
let mongodb = require('mongodb')
let mongoose = require('mongoose')
let XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest
require('dotenv').config();

module.exports = function (app) {
  
  let uri = process.env.DB;
  mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  
  let stockSchema = new mongoose.Schema({
    name: {type: String, required: true},
    price: { type: Number },
    likes: {type: Number, default: 0},
    ips: [String]
  })
  
  let Stock = mongoose.model('stock', stockSchema)
  
  app.route('/api/stock-prices')
    .get(function (req, res){
    
      let responseObject = {}
      responseObject['stockData'] = {}

      // Variable to determine number of stocks
      let twoStocks = false

      /* Output Response */
      let outputResponse = () => {
          return res.json(responseObject)
      }
      let stocks = [];

      /* Find/Update Stock Document */
      let findOrUpdateStock = (stockName, documentUpdate, nextStep) => {
        Stock.findOneAndUpdate({ name: stockName }, documentUpdate, { new: true, upsert: true })
          .then(stockDocument => {
            if (stockDocument) {
              if (twoStocks === false) {
                return nextStep(stockDocument, processOneStock);
              } else {
                return nextStep(stockDocument, processTwoStocks);
              }
            }
          })
          .catch(error => {
            console.log(error);
          });
      };
      

      /* Like Stock */
      let likeStock = (stockName, nextStep) => {
        Stock.findOne({ name: stockName })
          .exec()
          .then(stockDocument => {
            if (stockDocument && stockDocument['ips'] && stockDocument['ips'].includes(req.ip)) {
              return res.json('Error: Only 1 Like per IP Allowed');
            } else {
              let documentUpdate = { $inc: { likes: 1 }, $push: { ips: req.ip } };
              nextStep(stockName, documentUpdate, getPrice);
            }
          })
          .catch(error => {
            console.log(error);
          });
      };
      
      /* Get Price */
      let getPrice = (stockDocument, nextStep) => {
        let xhr = new XMLHttpRequest()
        let requestUrl = 'https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/' + stockDocument['name'] + '/quote'
        xhr.open('GET', requestUrl, true)
        xhr.onload = () => {
          let apiResponse = JSON.parse(xhr.responseText)
          stockDocument['price'] = apiResponse['latestPrice'].toFixed(2)
          nextStep(stockDocument, outputResponse)
        }
        xhr.send()
      }

      /* Build Response for 1 Stock */
      let processOneStock = (stockDocument, nextStep) => {
        responseObject['stockData']['stock'] = stockDocument['name'];
        responseObject['stockData']['price'] = parseFloat(stockDocument['price'].toFixed(2));
        responseObject['stockData']['likes'] = Number(stockDocument['likes']);
        nextStep();
      };
      

      let processTwoStocks = (stockDocument, nextStep) => {
        let newStock = {};
        newStock['stock'] = stockDocument['name'];
        newStock['price'] = parseFloat(stockDocument['price'].toFixed(2));
        newStock['likes'] = Number(stockDocument['likes']);
        stocks.push(newStock);
        if (stocks.length === 2) {
          stocks[0]['rel_likes'] = stocks[0]['likes'] - stocks[1]['likes'];
          stocks[1]['rel_likes'] = stocks[1]['likes'] - stocks[0]['likes'];
          responseObject['stockData'] = stocks;
          nextStep();
        } else {
          return;
        }
      };
      

      /* Process Input*/  
      if(typeof (req.query.stock) === 'string'){
        /* One Stock */
        let stockName = req.query.stock
        
        let documentUpdate = {}
        if(req.query.like && req.query.like === 'true'){
            likeStock(stockName, findOrUpdateStock)
        }else{
            findOrUpdateStock(stockName, documentUpdate, getPrice)
        }


      } else if (Array.isArray(req.query.stock)){
        twoStocks = true
        
        /* Stock 1 */
        let stockName = req.query.stock[0]
        if(req.query.like && req.query.like === 'true'){
            likeStock(stockName, findOrUpdateStock)
        }else{
            let documentUpdate = {}
            findOrUpdateStock(stockName, documentUpdate, getPrice)
        }

        /* Stock 2 */
        stockName = req.query.stock[1]
        if(req.query.like && req.query.like === 'true'){
            likeStock(stockName, findOrUpdateStock)
        }else{
            let documentUpdate = {}
            findOrUpdateStock(stockName, documentUpdate, getPrice)
        }


      }
    });
    
};
