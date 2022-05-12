const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
require("dotenv").config()
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ddzvi.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try{
       await client.connect()
       const servicesCollection = client.db("medico_healer").collection("services");

       app.get("/services", async (req, res) => {
           const query = {};
           const cursor = await servicesCollection.find(query).toArray();
           res.send(cursor)
       })
    
    }   
    finally{

    }         
}

run().catch(console.dir)

app.get("/" , (req, res) => {
    res.send("Hello! I am Mr.Developer from medico healer")
})

app.listen(port, () => {
    console.log(`listening to the port: ${port}`);
})
