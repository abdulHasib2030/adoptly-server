require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')


const app = express();
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true, // Allow cookies
  })
);
// middleware
const port = process.env.PORT || 5000;
app.use(express.json());
app.use(cookieParser())


const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.kpzks.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db('adoptly').collection('users')
    const petCollection = client.db('adoptly').collection('pets')
    const donationCollection = client.db('adoptly').collection('donation')
    const adoptPetCollection = client.db('adoptly').collection('adopt-pet')

    const verifyToken = (req, res, next) => {
      // console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(' ')[1];

      jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "forbidden access" })
        }
        req.decoded = decoded
        next()
      })
    }


    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '24h' })

      res.send({ token })

    })


    //  add user 
    app.post('/add-user', async (req, res) => {
      const userData = req.body;
      const findUser = await usersCollection.findOne({ email: userData.email })
      if (findUser === null) {

        const result = await usersCollection.insertOne(userData)
        return res.send(result)
      }
      else {
        return res.send(findUser)
      }

    })

    app.get('/user', async (req, res) => {
      const email = req.query.email;
      const findUser = await usersCollection.findOne({ email: email })
      res.send(findUser)

    })

    app.post('/logout', (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? "none" : "strict",

      })
        .send({ success: true })
    })

    //  ------------- add a pet ------------------//
    app.post('/add-pet', async (req, res) => {
      const data = req.body;

      const result = await petCollection.insertOne(data)
      res.send(result)
    })

    app.get('/pets', async (req, res) => {
      const user = req.query.email;
      const category = req.query.category;
      const search = req.query.search;
      console.log(category, search);
      let result;
      if (user)
        result = await petCollection.find({ user: user }).toArray()
      else if (category && search) {
        const searchFilter = { name: { $regex: search, $options: 'i' } }; // Case-insensitive search
        const query = category === 'all'
          ? searchFilter // If category is 'all', only apply the search filter
          : { category, ...searchFilter }; // Apply both category and search filter

        result = await petCollection.find(query).toArray();
      }
      else {
        result = await petCollection.find({ adopted: false }).sort({ date: -1 }).toArray()

      }

      res.send(result)
    })

    app.get('/pet/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await petCollection.find(query).toArray()
      res.send(result)
    })

    app.patch('/update-pet', async (req, res) => {
      const data = req.body;
      const filter = { _id: new ObjectId(data.id) }
      if (data.adopted) {
        const updateDoc = {
          $set: {
            adopted: data.adopted
          }
        }
        const result = await petCollection.updateOne(filter, updateDoc)
        return res.send(result)

      }
      const updateDoc = {
        $set: {
          image: data.image,
          name: data.name,
          age: data.age,
          category: data.category,
          location: data.location,
          note_owner: data.note_owner,
          description: data.description,
        }
      }
      const result = await petCollection.updateOne(filter, updateDoc)

      res.send(result)
    })
    // delete pet
    app.delete('/delete-pet/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await petCollection.deleteOne(query)
      res.send(result)
    })

    // donation 
    app.post('/add-donation', async (req, res) => {
      const query = req.query.email;
      const data = req.body;
      const result = await donationCollection.insertOne(data)
      res.send(result)
    })

    app.get('/donation', async (req, res) => {
      const email = req.query.email;
      const query = { user: email }
      console.log(email);
      let result;
      if(email)
        result = await donationCollection.find(query).toArray()
      else{
        result = await donationCollection.find().toArray()
      }

      res.send(result)
    })

    // update and get
    app.get('/update-donation/:id', async (req, res) => {
      const id = req.params.id;
      const result = await donationCollection.findOne({ _id: new ObjectId(id) })
      res.send(result)
    })

    app.put('/update-donation', async (req, res) => {
      const data = req.body;
      const filter = { _id: data.id }
      const updateDoc = {
        $set: {
          image: data.image,
          name: data.name,
          donation: data.donation,
          lst_date: data.lst_date,
          shortDescription: data.shortDescription,
          description: data.description,
          lst_update: data.lst_update,
        }
      }
      const result = await donationCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    // Admin -------------------//
    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" })
      }

      next()
    }
    app.get('/allusers', verifyToken, verifyAdmin, async (req, res) => {

      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    app.patch('/user-role-update', verifyToken, verifyAdmin, async (req, res) => {
      const data = req.body;
      const filter = { _id: new ObjectId(data.id) }
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    // all pets
    app.get('/allpets', async (req, res) => {
      const result = await petCollection.find().toArray()
      res.send(result)
    })

    // pet delete
    app.delete('/pet-delete/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await petCollection.deleteOne({ _id: new ObjectId(id) })
      res.send(result)
    })

    app.patch('/update-pet-status', verifyToken, verifyAdmin, async (req, res) => {
      const data = req.body;
      const filter = { _id: new ObjectId(data.id) }
      const updateDoc = {
        $set: {
          adopted: data.status ? false : true
        }
      }
      const result = await petCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    //  all donations
    app.get('/all-donation', verifyToken, verifyAdmin, async (req, res) => {
      const result = await donationCollection.find().toArray()
      res.send(result)
    })

    app.delete('/donation-delete/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await donationCollection.deleteOne({ _id: new ObjectId(id) })
      res.send(result)
    })

    app.patch('/update-donation-status', verifyToken, verifyAdmin, async (req, res) => {
      const data = req.body;
      const filter = { _id: new ObjectId(data.id) }
      const updateDoc = {
        $set: {
          pause: data.status ? false : true
        }
      }
      const result = await donationCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    // adopt pet 
    app.post('/adopt', verifyToken, async(req, res)=>{
      const data = req.body;
      const result = await adoptPetCollection.insertOne(data)
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {

})