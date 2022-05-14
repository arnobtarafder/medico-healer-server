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
    try {
        await client.connect()
        const serviceCollection = client.db("medico_healer").collection("services");
        const bookingCollection = client.db("medico_healer").collection("bookings");

        
        /**
         * API Naming Convention
         * app.get("/booking") // get all booking in this collection. or get more than one or by filter
         * app.get("/booking/:id") // get a specific booking
         * app.post("/booking") // add a new booking
         * app.patch("/booking/:id") //
         * app.delete("/booking/:id")
         */
        

        app.get("/services", async (req, res) => {
            const query = {};
            const collection = await serviceCollection.find(query).toArray();
            res.send(collection);
        })

        app.post("/booking", async (req, res) => {
            const booking = req.body;
            const query = {treatment: booking?.treatment, date: booking?.date, patient: booking?.patientName};
            console.log(booking);
            const exists = await bookingCollection.findOne(query);
            if(exists) {
                return res.send({success: false, booking: exists})
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({success: true, result});
        })

    }
    finally {

    }
}

run().catch(console.dir)

app.get("/", (req, res) => {
    res.send("Hello! I am Mr.Developer from medico healer")
})

app.listen(port, () => {
    console.log(`listening to the port: ${port}`);
})
