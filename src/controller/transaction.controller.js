const transactionModel = require("../models/transaction.model")
const ledgerModel = require("../models/ledger.model")
const emailService = require("../services/email.service")
const accountModel = require("../models/account.model")
const mongoose = require("mongoose")




async function createTransaction(req,res){

//validate request STEP 1

const { fromAccount, toAccount, amount , idempotencyKey} = req.body;

if( !fromAccount || !toAccount || !amount || !idempotencyKey) {
    return res.status(400).json({
        message: "FromAccount , ToAccount, Amount and Idempotency Key are required"
    })
}

const fromUserAccount = await accountModel.findOne({
_id: fromAccount,
})

const toUserAccount = await accountModel.findOne({
_id: toAccount,
})

if( !fromUserAccount || !toUserAccount){
    return res.status(400).json({
        message: "Invalid fromAccount or toAccount"
    })
}

//validate idempotency key

const isTransactionAlreadyExists = await transactionModel.findOne({
    idempotencyKey: idempotencyKey
})

if(isTransactionAlreadyExists){
    if(isTransactionAlreadyExists.status === "COMPLETED"){
        return res.status(200).json({
            message: "Transaction already processed",
            transaction: isTransactionAlreadyExists
        })
    }

     if(isTransactionAlreadyExists.status === "PENDING"){
        return res.status(200).json({
            message: "Transaction is still processing",
            
        })
    }

     if(isTransactionAlreadyExists.status === "FAILED"){
        return res.status(500).json({
            message: "Transaction failed",
            
        })
    }

     if(isTransactionAlreadyExists.status === "REVERSED"){
        return res.status(500).json({
            message: "Transaction is reversed , try again",
            
        })
    }

}

//STEP 3 CHECK ACCOUNT STATUS

 if(fromUserAccount.status !== "ACTIVE" || toUserAccount.status !== "ACTIVE") {
return res.status(400).json({
    message: "Both FromAccount and ToAccount must be active during Transaction"
})
 }


 //STEP 4 DERIVING SENDER BALANCE FROM LEDGER

 const balance = await fromUserAccount.getBalance()

 if(balance < amount){
    return res.status(400).json({
        message: `Insufficient Balance, Current Balance is ${balance}, Requested Amount  is ${amount}`
    })
 }

 //STEP 5 CREATING TRANSACTION


let transaction;
try{


 const session = await mongoose.startSession()
 session.startTransaction()

 transaction =( await transactionModel.create([{
    fromAccount,
    toAccount,
    amount,
    idempotencyKey,
    status: "PENDING"
 } ], {session} ) ) [0]

 const debitLedgerEntry = await ledgerModel.create([{
    account: fromAccount,
    amount: amount,
    transaction: transaction._id,
    type: "DEBIT"
 }],{session})

 await ( () =>  {
 return new Promise((resolve) => setTimeout(resolve, 15*1000) );
 })()

  const CreditLedgerEntry = await ledgerModel.create([{
    account: toAccount,
    amount: amount,
    transaction: transaction._id,
    type: "CREDIT"
 }],{session})

 transaction.status = "COMPLETED"
 await transaction.save({ session })

 await session.commitTransaction()
 session.endSession()

}catch(error) {
    return res.status(400).json({
        message: "Transaction is pending due to some issue,please retry after sometime",
    })
 }



//STEP 6 create email notification

await emailService.sendTransactionEmail(req.user.email, req.user.name, amount,toAccount);{
     return res.status(201).json({
message: "Transaction completed SUCCESSFULLY",
transaction: transaction
    })
}


}

async function createIntialFundsTransaction(req,res){
    const { toAccount, amount, idempotencyKey} = req.body

    if(!toAccount || !amount || !idempotencyKey){
        return res.status(400).json({
            message:"toAccount, amount and idempotencyKeyare required"
        })
    }

    const toUserAccount = await accountModel.findOne({
        _id: toAccount,
    })

    if(!toUserAccount){
        return res.status(400).json({
            message: "Invalid Account"
        })
    }

    const fromUserAccount = await accountModel.findOne({
        
        user: req.user._id
    })

    if(!fromUserAccount) {
        return res.status(400).json({
            message: "System user account not found"
        })
    }


    const session = await mongoose.startSession()
    session.startTransaction()

    const transaction = new transactionModel({
        fromAccount: fromUserAccount._id,
        toAccount,
        amount,
        idempotencyKey,
        status: "PENDING"
    })

   

    const creditLedgerEntry = await ledgerModel.create([{
        account: toAccount,
        amount: amount,
        transaction: transaction._id,
        type: "CREDIT"
    }],{session})

    transaction.status = "COMPLETED"
    await transaction.save({session})

    await session.commitTransaction()
    session.endSession()

    return res.status(201).json({
        message:"Intial Funds Transaction successfully",
        transaction: transaction
    })

}

module.exports = {
    createTransaction,
    createIntialFundsTransaction
};
