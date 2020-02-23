
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://bibUser:xLUBmiK5byDfYAzT@bibcluster-e4tmw.mongodb.net/test?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true });
client.connect(err => {
  if (err) console.log(err) 
  const collection = client.db("test").collection("devices");
  // perform actions on the collection object
  client.close();
});
