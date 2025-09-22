import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    // const uniqueSuffix =Date.now()+"-"+Math.round(Math.random()*1E9)
    cb(null, file.originalname); // change filename to scale because dupliaction can happen so best practice to store unique file name
  },
});

export const upload = multer({ storage });
