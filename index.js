const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// MiddleWare
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://job-portal-1b517.web.app",
      "https://job-portal-1b517.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  console.log("Now iuside call in verifyToken", req.cookies);
  const token = req?.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unAthorized Access" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unathorized Access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.40t0y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    // Jobs Related API
    const jobsCollection = client.db("jobPortal").collection("jobs");
    const jobApplicationCollection = client
      .db("jobPortal")
      .collection("job_application");

    // Auth Related API's

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: "12h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          // secure: false, // secret : true only production base
          secure: process.env.NODE_ENV === "production",
        })
        .send({ success: true });
    });

    app.post("/logout", (req, res) => {
      res
        .cookie("token", {
          httpOnly: true,
          // secure: false, // secret : true only production base
          secure: process.env.NODE_ENV === "production",
        })
        .send({ message: true });
    });

    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { hr_email: email };
      }
      const cursor = jobsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Job Details API's
    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    });
    // Job Application API's
    app.get("/job_application", verifyToken, async (req, res) => {
      console.log("now inside the callback api");
      const email = req.query.email;
      const query = { application_email: email };

      if (req.user.email !== req.query.email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const result = await jobApplicationCollection.find(query).toArray();

      // Fhokira way to myApplications data Aggreged
      for (const application of result) {
        console.log(application.job_id);
        const query1 = { _id: new ObjectId(application.job_id) };
        const job = await jobsCollection.findOne(query1);
        if (job) {
          application.title = job.title;
          application.company = job.company;
          application.company_logo = job.company_logo;
          application.location = job.location;
        }
      }

      res.send(result);
    });

    // View Applicatins API

    app.get("/job_application/jobs/:job_id", async (req, res) => {
      const jobId = req.params.job_id;
      const query = { job_id: jobId };
      const result = await jobApplicationCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/job_application", async (req, res) => {
      const application = req.body;
      const result = await jobApplicationCollection.insertOne(application);

      // Not the Best Way

      const id = application.job_id;
      const query = { _id: new ObjectId(id) };
      const job = await jobsCollection.findOne(query);
      let count = 0;
      if (job.applicationCount) {
        count = job.applicationCount + 1;
      } else {
        count = 1;
      }
      // Now Update Job Info
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          applicationCount: count,
        },
      };
      const updatedResult = await jobsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Parital one Data Updated
    app.patch("/job_application/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: data.status,
        },
      };
      const result = await jobApplicationCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Job Portal server is running.");
});

app.listen(port, () => {
  console.log(`Job is waiting at: ${port}`);
});
