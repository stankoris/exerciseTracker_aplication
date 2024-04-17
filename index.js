const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
require('dotenv').config();

const port = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true});

app.use(cors());
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const cssPath = __dirname + "/public"
app.use("/public", express.static(cssPath));

app.get("/", (req, res) => {
    res.sendFile(process.cwd() + "/views/index.html")
})

const userSchema = new Schema({
    username: String
});

const exerciseSchema = new mongoose.Schema({
	userId: String,
	username: String,
	description: { type: String, required: true },
	duration: { type: Number, required: true },
	date: String,
});

const User = mongoose.model('User', userSchema);
const Exercise = mongoose.model('Exercise', exerciseSchema);

const createUser = async (username) => {
    try {
        const newUser = new User({ username });
        const savedUser = await newUser.save();
        console.log(`Korisnik dodat : '${savedUser}'`);
        return savedUser;
    } catch (error) {
        throw error;
    }
};

app.post("/api/users", async (req, res) => {
    let username = req.body.username;

    if (!username) { 
        return res.json({ error: 'Korisnicko ime je obavezno.' }); 
    }

    try {
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            return res.json({ username: existingUser.username, _id: existingUser._id });
        }

        const newUser = await createUser(username);
        res.json({ username: newUser.username, _id: newUser._id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Doslo je do greske prilikom obrade zahteva.' });
    }
});

app.get("/api/users", async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Doslo je do greske prilikom dohvatanja korisnika.' });
    }
});

app.post('/api/users/:_id/exercises', async function (req, res) {
    var userId = req.params._id;
    var description = req.body.description;
    var duration = req.body.duration;
    var date = req.body.date;

    if (!date) {
        date = new Date().toISOString().substring(0, 10);
    }

    try {
        const userInDb = await User.findById(userId);
        if (!userInDb) {
            return res.json({ message: 'Ne postoji korisnik koji ima taj Id' });
        }

        let newExercise = new Exercise({
            userId: userInDb._id,
            username: userInDb.username,
            description: description,
            duration: parseInt(duration),
            date: date,
        });

        const exercise = await newExercise.save();
        res.json({
            username: userInDb.username,
            description: exercise.description,
            duration: exercise.duration,
            date: new Date(exercise.date).toDateString(),
            _id: userInDb._id,
        });
    } catch (err) {
        console.error(err);
        res.json({ message: 'Greska prilikom dodavanja vezbe!' });
    }
});

app.get('/api/users/:_id/logs', async function (req, res) {
    const userId = req.params._id;
    let { from, to, limit } = req.query;
    
    from = from || '1970-01-01';
    to = to || new Date().toISOString().substring(0, 10);
    limit = limit ? parseInt(limit) : 0;

    try {
        const user = await User.findById(userId).exec();

        if (!user) {
            return res.status(404).json({ message: 'Korisnik nije pronadjen' });
        }

        const exercisesQuery = {
            userId: userId,
            date: { $gte: from, $lte: to },
        };

        const exercises = await Exercise.find(exercisesQuery)
            .select('description duration date')
            .limit(limit)
            .exec();

        const log = exercises.map((exercise) => ({
            description: exercise.description,
            duration: exercise.duration,
            date: new Date(exercise.date).toDateString(),
        }));

        const response = {
            _id: user._id,
            username: user.username,
            from: from,
            to: to,
            count: log.length,
            log: log,
        };

        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Greska sa serverom' });
    }
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})