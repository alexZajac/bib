const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const MONGO_URI =
  "mongodb+srv://bibUser:xLUBmiK5byDfYAzT@bibcluster-e4tmw.mongodb.net/test?retryWrites=true&w=majority";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());

/**
 * Method to filter restaurants out of all the available ones
 * @param  {Object} restaurant1
 * @param  {Object} restaurant2
 * @param  {string} sorting criteria
 * @return {number} how r1 is positionned relative to r2
 */
const getSort = sortingFilter => {
  if (sortingFilter === "RATING_DESC") return { rating: -1 };
  if (sortingFilter === "RATING_ASC") return { rating: 1 };
  if (sortingFilter === "PRICE_ASC") return { avgPrice: 1 };
  if (sortingFilter === "PRICE_DESC") return { avgPrice: -1 };
};

/**
 * Method to read restaurants from db
 * @return {Array}: Array of objects restaurants
 */
const getRestaurantsFromDb = filters =>
  new Promise((resolve, reject) => {
    const client = new MongoClient(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    client.connect(err => {
      if (err) return reject(err);
      const collection = client.db("main").collection("restaurants");
      let aggregateOptions = buildAggregate(filters);
      collection.aggregate(aggregateOptions).toArray((err, data) => {
        if (err) return reject(err);
        resolve(data);
        client.close();
      });
    });
  });

const buildAggregate = filters => {
  const {
    distinctionValue,
    cookingValue,
    sortingValue,
    userLocation,
    query
  } = filters;
  const match = getMatch(distinctionValue, cookingValue, query);
  let result = [{ $match: match }];
  if (sortingValue === "DISTANCE" && userLocation) {
    const { lat, long } = userLocation;
    result.unshift({
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [long, lat]
        },
        distanceField: "distanceFromUser",
        spherical: true
      }
    });
  } else {
    // project avg price if needed
    if (sortingValue === "PRICE_DESC" || sortingValue === "PRICE_ASC") {
      result.push({
        $addFields: {
          avgPrice: { $divide: [{ $add: ["$price.top", "$price.bottom"] }, 2] }
        }
      });
    }
    result.push({ $sort: getSort(sortingValue) });
  }
  return result;
};

//   mondodb user: bibUser
// password: xLUBmiK5byDfYAzT

const getMatch = (distinctionValue, cookingValue, query) => {
  let match = {
    "distinction.type": distinctionValue
  };
  if (cookingValue !== "Toutes cuisines")
    match = { ...match, cookingType: cookingValue };
  if (query !== "")
    match = {
      ...match,
      name: new RegExp(query, "i")
    };
  return match;
};

app.post("/restaurants", async (req, res) => {
  const {
    distinction: { value: distinctionValue },
    cooking: { value: cookingValue },
    sorting: { value: sortingValue },
    userLocation,
    query
  } = req.body;
  const filters = {
    distinctionValue,
    cookingValue,
    sortingValue,
    query,
    userLocation
  };
  try {
    const filteredRestaurants = await getRestaurantsFromDb(filters);
    res.json({ error: "", restaurants: filteredRestaurants });
  } catch (e) {
    res.json({ error: e, restaurants: [] });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
