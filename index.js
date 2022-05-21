const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ddzvi.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}






async function run() {
    try {
        await client.connect()
        const serviceCollection = client.db("medico_healer").collection("services");
        const bookingCollection = client.db("medico_healer").collection("bookings");
        const userCollection = client.db("medico_healer").collection("users");
        const doctorCollection = client.db("medico_healer").collection("doctors");
        const paymentCollection = client.db("medico_healer").collection("payments");


        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === "admin") {
                next();
            }
            else {
                return res.status(403).send({ message: 'Forbidden access' })
            }
        }



        /**
         * API Naming Convention
         * app.get("/booking") // get all booking in this collection. or get more than one or by filter
         * app.get("/booking/:id") // get a specific booking
         * app.post("/booking") // add a new booking
         * app.patch("/booking/:id") //
         * app.put("/booking/:id") // upsert ==> update (if exists) or insert (if doesn't exist)
         * app.delete("/booking/:id")
         */


        app.get("/services", async (req, res) => {
            const query = {};
            const collection = await serviceCollection.find(query).project({ name: 1 }).toArray();
            res.send(collection);
        })

        app.get("/users", verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users)
        })


        app.put("/users/:email", async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            }
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })

            res.send({ result, token });
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user?.role === 'admin';
            res.send({ admin: isAdmin });
        })


        app.put("/users/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: "admin" },
            }
            const result = await userCollection.updateOne(filter, updateDoc);

            res.send(result);
        })




        //-------------BOOKING  
        app.get("/booking", verifyJWT, async (req, res) => {
            const patient = req?.query?.patient;
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }

        })

        app.get("/booking/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const booking = await bookingCollection.findOne(query);
            res.send(booking)
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        })

        app.patch("/booking/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }

            const updatedBooking = await bookingCollection.updateOne(filter, updatedDoc)
            const result = await paymentCollection.insertOne(payment)
            res.send(result)
        })




        //----------------PAYMENT
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });



        //----------------DOCTOR
        app.get("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
            const doctors = await doctorCollection.find().toArray();
            res.send(doctors);
        })


        app.post("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorCollection.insertOne(doctor);
            res.send(result);
        })

        app.delete("/doctors/:email", verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const result = await doctorCollection.deleteOne(filter);
            res.send(result);
        })





        // WARNING::
        // THIS IS NOT THE PROPER WAY TO QUERY,
        // AFTER LEARNING MORE ABOUT MONGODB, USE AGGREGATE LOOKUP, PIPELINE, MATCH, GROUP
        app.get("/available", async (req, res) => {
            const date = req.query.date;
            // console.log(date);

            // step 1: get all services
            const services = await serviceCollection.find().toArray();

            // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}]
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();

            // step 3: for each serviceCollection, find bookings for that service 
            services.forEach(service => {
                // steps 4: find bookings for that service. output: [{}, {}, {}]
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                // steps 5: select slots for the service Bookings: ['', '', '']
                const bookedSlots = serviceBookings.map(book => book.slot);
                // service.booked = bookedSlots;
                // steps 6: select those slots that are not in book Slots 
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                // step 7: set available to slots to make it easier 
                service.slots = available;
            })

            res.send(services)
        })

        console.log("connected to database");
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
