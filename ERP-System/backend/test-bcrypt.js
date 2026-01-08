const bcrypt = require('bcryptjs');
console.log("Bcrypt loaded");
bcrypt.hash("test", 10).then(h => console.log("Hash:", h));
