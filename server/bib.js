const utils = require("./utils");
const axios = require("axios");
const { get: maitreGet } = require("./maitre");
const { get: michelinGet } = require("./michelin");
const { MongoClient } = require("mongodb");
const { MONGO_URI, LOCATIONIQ_API_KEY } = process.env;
const { readJson, trimSpace, distance } = utils;

const THRESHOLD_NAME = 0.9;
const THRESHOLD_PHONE = 1;
const THRESHOLD_ADRESS = 0.7;

/**
 * Return valid string if property is not defined
 * @return {string} defined string
 */
const validate = str => (str ? str : "");

/**
 * Fits maitre restaurant to standard representation (lowercase etc)
 * @param {string} name
 * @param {string} phone
 * @param {Object} location
 * @return {Object} Formatted object
 */
const normalizeMaitreRestaurant = (name, phone, location) => {
  const formattedMaitreName = trimSpace(validate(name).toLowerCase());
  const formattedMaitrePhone = validate(phone);
  const { town: t, street: s, zipCode: z } = location;
  const town = trimSpace(validate(t).toLowerCase());
  const street = trimSpace(validate(s).toLowerCase());
  const zipCode = trimSpace(validate(z).toLowerCase());
  const formattedMaitreAdress = town + street + zipCode;
  return { formattedMaitreName, formattedMaitrePhone, formattedMaitreAdress };
};

/**
 * Fits bib restaurant to standard representation (lowercase etc)
 * @param {string} name
 * @param {string} phone
 * @param {Object} location
 * @return {Object} Formatted object
 */
const normalizeMichelinRestaurant = (name, phone, location) => {
  const formattedMichName = trimSpace(validate(name).toLowerCase());
  let formattedMichPhone = validate(phone).substr(4, phone.length - 4);
  formattedMichPhone = "0" + formattedMichPhone;
  const { town: t, street: s, zipCode: z } = location;
  const town = trimSpace(validate(t).toLowerCase());
  const street = trimSpace(validate(s).toLowerCase());
  const zipCode = trimSpace(validate(z).toLowerCase());
  const formattedMichAdress = town + street + zipCode;
  return { formattedMichName, formattedMichPhone, formattedMichAdress };
};

/**
 * Get all France located Bib Gourmand restaurants
 * @return {Array} restaurants
 */
const getGoldenRestaurants = (michelinRestaurants, maitreRestaurants) => {
  let results = [];
  michelinRestaurants.forEach(michelin_r => {
    let { name, phone, location } = michelin_r;
    const {
      formattedMichName,
      formattedMichPhone,
      formattedMichAdress
    } = normalizeMichelinRestaurant(name, phone, location);
    for (let j = 0; j < maitreRestaurants.length; j++) {
      const mai_r = maitreRestaurants[j];
      let { name, phone, location } = mai_r;
      const {
        formattedMaitreName,
        formattedMaitrePhone,
        formattedMaitreAdress
      } = normalizeMaitreRestaurant(name, phone, location);
      // if names have a 90% similitude, and phone are same, or address have a 80%
      if (
        distance(formattedMichName, formattedMaitreName) >= THRESHOLD_NAME &&
        (distance(formattedMichPhone, formattedMaitrePhone) >=
          THRESHOLD_PHONE ||
          distance(formattedMichAdress, formattedMaitreAdress) >=
            THRESHOLD_ADRESS)
      ) {
        results.push(michelin_r);
        break;
      }
    }
  });
  return results;
};

/**
 * Sleeps on the main thread for the specified amount of ms
 */
const sleep = (ms = 1000) => {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < ms);
};

/**
 * Adds coordinates to existing restaurants
 * @return {Promise} Bib restaurants with Maitre Restaurateur distinction and Geocoding properties
 */
const encodeCoordinates = async restaurants =>
  new Promise(async (resolve, _) => {
    let result = [];
    for (let i = 0; i < restaurants.length; i++) {
      const {
        location: { street, town, zipCode }
      } = restaurants[i];
      const url = `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_API_KEY}&q=${encodeURI(
        street
      )},${encodeURI(town)},${encodeURI(zipCode)},France&format=json`;

      let lat = (long = 0);
      try {
        const results = await axios(url);
        const { data } = results;
        if (data.length > 0) {
          lat = parseFloat(data[0].lat);
          long = parseFloat(data[0].lon);
        }
        sleep();
      } catch (e) {
        console.log(e);
      } finally {
        result.push({
          ...restaurants[i],
          location: { type: "Point", coordinates: [long, lat] }
        });
      }
    }
    resolve(result);
  });

const writeToDatabase = restaurants => {
  const client = new MongoClient(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  client.connect(err => {
    if (err) console.error(err);
    const collection = client.db("main").collection("restaurants");
    collection.deleteMany({}, (err, res) => {
      if (err) console.error(err);
      console.log(`Deleted ${res.deletedCount} objects`);
      collection.insertMany(restaurants, (err, res) => {
        if (err) console.error(err);
        console.log(`Number of documents inserted: ${res.insertedCount}`);
        client.close();
      });
    });
  });
};

/**
 * Get all France located Michelin restaurants and writes themlet to json file
 * @return {Array} Bib restaurants with Maitre Restaurateur distinction
 */
const get = async (withWrite = true) => {
  const michelinRestaurants = await michelinGet();
  const maitreRestaurants = await maitreGet();
  const goldenRestaurants = getGoldenRestaurants(
    michelinRestaurants,
    maitreRestaurants
  );
  // encode coordinates
  try {
    const result = await encodeCoordinates(goldenRestaurants);
    if (withWrite) writeToDatabase(result);
    return result.filter(r => r.distinction.type === "BIB_GOURMAND");
  } catch (e) {
    console.error(e);
  }
};

module.exports = {
  get
};

_ = get();
