const mongoose = require("mongoose")

function connectToDB() {
    mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("Server is connected to DB")
    })
     .catch((error) => {
        console.log("Error connnecting to DB",error)
        process.exit(1)
    })
}

module.exports = connectToDB