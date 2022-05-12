const express = require('express');
const app = express();
const port = process.env.PORT || 5000;

app.get("/" , (req, res) => {
    res.send("Hello! I am mr.Developer from medico healer")
})

app.listen(port, () => {
    console.log(`listening to the port: ${port}`);
})
