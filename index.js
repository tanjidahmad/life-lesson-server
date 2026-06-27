const dns = require("node:dns");

dns.setServers(["8.8.8.8", "8.8.4.4"])

const express = require("express");
const cors = require("cors");
const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
} = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

require("dotenv").config();

const app = express();
const port = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());




app.get("/", (req, res) => {
  res.send("Life Lessons Server Running");
});

const uri = process.env.MONGO_DB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

 const JWKS= createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`))

const verifyToken = async (req, res, next)=>{

 const authHeader =
     req.headers.authorization;
if (!authHeader|| !authHeader.startsWith("Bearer")) {
     return res.status(401).send({
       success: false,
       message: "Unauthorized Access",
    });
   }
const token =
     authHeader.split(" ")[1];
     console.log(token)
   if (!token) {
     return res.status(401).send({
       success: false,
      message: "Unauthorized Access",
    });
   }

   try{
    const {payload} = await jwtVerify(token, JWKS)
    console.log(payload)
    req.user=payload

    next()
   }
   catch(error){
    console.log(error)
    return res.status(401).json({msg:"Unauthorized"});
   }


}

const adminVerify=async(req,res,next)=>{
  const user= req.user;
  console.log("user from adminVerify", user)
  next()
}




async function run() {
  try {
    

    const database = client.db("life_lessons_db");

    const usersCollection =
      database.collection("user");

    const lessonsCollection =
      database.collection("lessons");

    const commentsCollection =
      database.collection("comments");

    const favoritesCollection =
      database.collection("favorites");

    const reportsCollection =
      database.collection("lessonsReports");



app.get('/api/lessons', async (req, res) => {
  try {
    const {
      search,
      category,
      emotionalTone,
      sort,
      admin,
    } = req.query;

    const query = {};

    // normal lessons page => only public
    // admin manage lessons => all lessons
    if (admin !== "true") {
      query.visibility = "public";
    }

    if (search) {
      query.title = {
        $regex: search,
        $options: "i",
      };
    }

    if (category) {
      query.category = category;
    }

    if (emotionalTone) {
      query.emotionalTone = emotionalTone;
    }

    let sortOption = { createdAt: -1 };

    if (sort === "newest") {
      sortOption = { createdAt: -1 };
    }

    if (sort === "saved") {
      sortOption = { favoritesCount: -1 };
    }

    const page = parseInt(req.query.page) || 1;

    // admin page teo pagination thakbe
    const limit =
      admin === "true"
        ? parseInt(req.query.limit) || 10
        : parseInt(req.query.limit) || 6;

    const skip = (page - 1) * limit;

    const lessons = await lessonsCollection
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .toArray();

    const lessonsWithCreator = await Promise.all(
      lessons.map(async (lesson) => {
        const creator = await usersCollection.findOne({
          email: {
            $regex: `^${lesson.creatorEmail}$`,
            $options: "i",
          },
        });

        return {
          ...lesson,
          creatorImage:
            creator?.image ||
            "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500",
          creatorPlan: creator?.plan || "free",
          creatorRole: creator?.role || "user",
        };
      })
    );

    const totalLessons = await lessonsCollection.countDocuments(query);

    res.send({
      lessons: lessonsWithCreator,
      totalLessons,
      currentPage: page,
      totalPages: Math.ceil(totalLessons / limit),
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});


    // =========================
    // LESSONS API END
    // =========================
    // GET SINGLE LESSON
app.get("/api/lessons/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const lesson =
      await lessonsCollection.findOne({
        _id: new ObjectId(id),
      });

    if (!lesson) {
      return res.status(404).send({
        success: false,
        message: "Lesson not found",
      });
    }

    console.log(
      "Lesson Email:",
      lesson.creatorEmail
    );

    const creator =
      await usersCollection.findOne({
        email: {
          $regex: `^${lesson.creatorEmail}$`,
          $options: "i",
        },
      });

    console.log("Creator:", creator);

    res.send({
      ...lesson,
      creatorImage:
        creator?.image ||
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500",
      creatorPlan:
        creator?.plan || "free",
      creatorRole:
        creator?.role || "user",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});
// CREATE LESSON
app.post('/api/lessons',verifyToken, async (req, res) => {
  try {

    const lesson = req.body;

    const newLesson = {
      ...lesson,

      likes: [],
      likesCount: 0,

      favoritesCount: 0,

      isFeatured: false,
      isReviewed: false,

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result =
      await lessonsCollection.insertOne(
        newLesson
      );

    res.send(result);

  } catch (error) {

    res.status(500).send({
      success: false,
      message: error.message
    });

  }
});

// UPDATE LESSON
app.patch('/api/lessons/:id', async (req, res) => {
  try {

    const id = req.params.id;
    const updatedData = req.body;

    const filter = {
      _id: new ObjectId(id)
    };

    const updateDoc = {
      $set: {
        ...updatedData,
        updatedAt: new Date()
      }
    };

    const result =
      await lessonsCollection.updateOne(
        filter,
        updateDoc
      );

    res.send(result);

  } catch (error) {

    res.status(500).send({
      success: false,
      message: error.message
    });

  }
});

// DELETE LESSON
app.delete('/api/lessons/:id', async (req, res) => {
  try {

    const id = req.params.id;

    const result =
      await lessonsCollection.deleteOne({
        _id: new ObjectId(id)
      });

    res.send(result);

  } catch (error) {

    res.status(500).send({
      success: false,
      message: error.message
    });

  }
});

// SAVE FAVORITE
app.post('/api/favorites',verifyToken, async (req, res) => {
  try {

    const favorite = req.body;

    const existingFavorite =
      await favoritesCollection.findOne({
        lessonId: favorite.lessonId,
        userEmail: favorite.userEmail
      });

    if (existingFavorite) {
      return res.status(400).send({
        success: false,
        message: "Already favorited"
      });
    }

    const result =
      await favoritesCollection.insertOne({
        ...favorite,
        createdAt: new Date()
      });

    await lessonsCollection.updateOne(
      {
        _id: new ObjectId(favorite.lessonId)
      },
      {
        $inc: {
          favoritesCount: 1
        }
      }
    );

    res.send(result);

  } catch (error) {

    res.status(500).send({
      success: false,
      message: error.message
    });

  }
});

// GET MY FAVORITES
app.get('/api/favorites/:email',verifyToken, async (req, res) => {
  try {

    const email = req.params.email;

    const favorites =
  await favoritesCollection
    .find({
      userEmail: email,
    })
    .toArray();

const favoriteLessons =
  await Promise.all(
    favorites.map(
      async (favorite) => {
        const lesson =
          await lessonsCollection.findOne({
            _id: new ObjectId(
              favorite.lessonId
            ),
          });

        return {
          ...favorite,
          lesson,
        };
      }
    )
  );

res.send(favoriteLessons);

  } catch (error) {

    res.status(500).send({
      success: false,
      message: error.message
    });

  }
});

// REMOVE FAVORITE
app.delete('/api/favorites/:id', async (req, res) => {
  try {

    const id = req.params.id;

    const favorite =
      await favoritesCollection.findOne({
        _id: new ObjectId(id)
      });

    if (!favorite) {
      return res.status(404).send({
        success: false,
        message: "Favorite not found"
      });
    }

    const result =
      await favoritesCollection.deleteOne({
        _id: new ObjectId(id)
      });

    await lessonsCollection.updateOne(
      {
        _id: new ObjectId(favorite.lessonId)
      },
      {
        $inc: {
          favoritesCount: -1
        }
      }
    );

    res.send(result);

  } catch (error) {

    res.status(500).send({
      success: false,
      message: error.message
    });

  }
});

// ADD COMMENT
app.post('/api/comments',verifyToken, async (req, res) => {
  try {

    const comment = req.body;

    const newComment = {
      ...comment,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result =
      await commentsCollection.insertOne(
        newComment
      );

    res.send(result);

  } catch (error) {

    res.status(500).send({
      success: false,
      message: error.message
    });

  }
});

// GET COMMENTS BY LESSON
app.get('/api/comments/:lessonId', async (req, res) => {
  try {

    const lessonId = req.params.lessonId;

    const comments = await commentsCollection
      .find({ lessonId })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(comments);

  } catch (error) {

    res.status(500).send({
      success: false,
      message: error.message
    });

  }
});

// REPORT LESSON
app.post('/api/reports',verifyToken, async (req, res) => {
  try {

    const report = req.body;

    const newReport = {
      ...report,
      createdAt: new Date()
    };

    const result =
      await reportsCollection.insertOne(
        newReport
      );

    res.send(result);

  } catch (error) {

    res.status(500).send({
      success: false,
      message: error.message
    });

  }
});

// GET ALL REPORTS
app.get('/api/reports', async (req, res) => {
  try {

    const reports = await reportsCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.send(reports);

  } catch (error) {

    res.status(500).send({
      success: false,
      message: error.message
    });

  }
});

// FEATURE LESSON
app.patch('/api/lessons/featured/:id', async (req, res) => {
  try {

    const id = req.params.id;

    const result =
      await lessonsCollection.updateOne(
        {
          _id: new ObjectId(id)
        },
        {
          $set: {
            isFeatured: true
          }
        }
      );

    res.send(result);

  } catch (error) {

    res.status(500).send({
      success: false,
      message: error.message
    });

  }
});
// REVIEW LESSON
app.patch('/api/lessons/reviewed/:id', async (req, res) => {
  try {

    const id = req.params.id;

    const result =
      await lessonsCollection.updateOne(
        {
          _id: new ObjectId(id)
        },
        {
          $set: {
            isReviewed: true
          }
        }
      );

    res.send(result);

  } catch (error) {

    res.status(500).send({
      success: false,
      message: error.message
    });

  }
});

// GET FEATURED LESSONS
app.get('/api/featured-lessons', async (req, res) => {
  try {

    const lessons =
      await lessonsCollection
        .find({
          isFeatured: true
        })
        .sort({
          createdAt: -1
        })
        .limit(6)
        .toArray();

    res.send(lessons);

  } catch (error) {

    res.status(500).send({
      success: false,
      message: error.message
    });

  }
});

// GET MY LESSONS
app.get('/api/my-lessons/:email',verifyToken, async (req, res) => {
  try {

    const email = req.params.email;

    const lessons = await lessonsCollection
      .find({
        creatorEmail: email
      })
      .sort({
        createdAt: -1
      })
      .toArray();

    res.send(lessons);

  } catch (error) {

    res.status(500).send({
      success: false,
      message: error.message
    });

  }
});

// DASHBOARD STATS
app.get('/api/dashboard-stats', async (req, res) => {
  try {

    const totalLessons =
      await lessonsCollection.countDocuments();

    const totalComments =
      await commentsCollection.countDocuments();

    const totalFavorites =
      await favoritesCollection.countDocuments();

    const totalReports =
      await reportsCollection.countDocuments();

    res.send({
      totalLessons,
      totalComments,
      totalFavorites,
      totalReports
    });

  } catch (error) {

    res.status(500).send({
      success: false,
      message: error.message
    });

  }
});

// UPGRADE USER TO PREMIUM
app.patch(
  "/api/users/premium/:email",
  async (req, res) => {
    try {
      const email =
        req.params.email;

      const result =
        await usersCollection.updateOne(
          {
            email: {
              $regex: `^${email}$`,
              $options: "i",
            },
          },
          {
            $set: {
              plan: "premium",
            },
          }
        );

      res.send({
        success: true,
        message:
          "User upgraded to premium",
        result,
      });
    } catch (error) {
      res.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }
);


app.patch("/api/lessons/like/:id",verifyToken, async (req, res) => {
try {
const lessonId = req.params.id;
const { userEmail } = req.body;


const lesson =
  await lessonsCollection.findOne({
    _id: new ObjectId(lessonId),
  });

if (!lesson) {
  return res.status(404).send({
    success: false,
    message: "Lesson not found",
  });
}

const alreadyLiked =
  lesson.likes?.includes(userEmail);

if (alreadyLiked) {
  await lessonsCollection.updateOne(
    {
      _id: new ObjectId(lessonId),
    },
    {
      $pull: {
        likes: userEmail,
      },
      $inc: {
        likesCount: -1,
      },
    }
  );

  return res.send({
    success: true,
    liked: false,
  });
}

await lessonsCollection.updateOne(
  {
    _id: new ObjectId(lessonId),
  },
  {
    $addToSet: {
      likes: userEmail,
    },
    $inc: {
      likesCount: 1,
    },
  }
);

res.send({
  success: true,
  liked: true,
});


} catch (error) {
res.status(500).send({
success: false,
message: error.message,
});
}
});

// ADMIN DASHBOARD STATS
app.get("/api/admin/stats", verifyToken,
  adminVerify,  async (req, res) => {
  try {
    const totalUsers =
      await usersCollection.countDocuments();

    const totalPublicLessons =
      await lessonsCollection.countDocuments({
        visibility: "public",
      });

    const totalReportedLessons =
      await reportsCollection.countDocuments();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysLessons =
      await lessonsCollection.countDocuments({
        createdAt: {
          $gte: today,
        },
      });

    const contributors =
      await lessonsCollection
        .aggregate([
          {
            $group: {
              _id: "$creatorEmail",
              totalLessons: {
                $sum: 1,
              },
            },
          },
          {
            $sort: {
              totalLessons: -1,
            },
          },
          {
            $limit: 5,
          },
        ])
        .toArray();

    // ===== LESSON GROWTH =====
    const lessonGrowthRaw =
      await lessonsCollection
        .aggregate([
          {
            $group: {
              _id: {
                month: {
                  $month: "$createdAt",
                },
              },
              count: {
                $sum: 1,
              },
            },
          },
          {
            $sort: {
              "_id.month": 1,
            },
          },
        ])
        .toArray();

    // ===== USER GROWTH =====
    const userGrowthRaw =
      await usersCollection
        .aggregate([
          {
            $group: {
              _id: {
                month: {
                  $month: "$createdAt",
                },
              },
              count: {
                $sum: 1,
              },
            },
          },
          {
            $sort: {
              "_id.month": 1,
            },
          },
        ])
        .toArray();

    const months = [
      "",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const lessonGrowth =
      lessonGrowthRaw.map((item) => ({
        month:
          months[item._id.month],
        count: item.count,
      }));

    const userGrowth =
      userGrowthRaw.map((item) => ({
        month:
          months[item._id.month],
        count: item.count,
      }));

    res.send({
      totalUsers,
      totalPublicLessons,
      totalReportedLessons,
      todaysLessons,
      contributors,
      lessonGrowth,
      userGrowth,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

// GET ALL USERS
app.get("/api/users", async (req, res) => {
  try {
    const users =
      await usersCollection.find().toArray();

    res.send(users);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

// MAKE ADMIN
app.patch(
  "/api/users/admin/:id",
  async (req, res) => {
    try {
      const id = req.params.id;

      const result =
        await usersCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              role: "admin",
            },
          }
        );

      res.send(result);
    } catch (error) {
      res.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }
);
// UPDATE PROFILE
app.patch(
  "/api/users/profile/:email",
  async (req, res) => {
    try {
      const email =
        req.params.email;

      const {
        name,
        image,
      } = req.body;

      const result =
        await usersCollection.updateOne(
          {
            email: {
              $regex: `^${email}$`,
              $options: "i",
            },
          },
          {
            $set: {
              name,
              image,
            },
          }
        );

      res.send(result);
    } catch (error) {
      res.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }
);





app.get("/api/admin/lesson-stats", async (req, res) => {
  try {
    const publicLessons =
      await lessonsCollection.countDocuments({
        visibility: "public",
      });

    const privateLessons =
      await lessonsCollection.countDocuments({
        visibility: "private",
      });

    const flaggedLessons =
      await reportsCollection.countDocuments();

    res.send({
      publicLessons,
      privateLessons,
      flaggedLessons,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

// GET REPORTED LESSONS
app.get(
  "/api/admin/reported-lessons", verifyToken,
  adminVerify,
  async (req, res) => {
    try {
      const reportedLessons =
        await reportsCollection
          .aggregate([
            {
              $group: {
                _id: "$lessonId",
                reportCount: {
                  $sum: 1,
                },
              },
            },
          ])
          .toArray();

      const result =
        await Promise.all(
          reportedLessons.map(
            async (report) => {
              const lesson =
                await lessonsCollection.findOne(
                  {
                    _id:
                      new ObjectId(
                        report._id
                      ),
                  }
                );

              return {
                lessonId:
                  report._id,
                reportCount:
                  report.reportCount,
                lesson,
              };
            }
          )
        );

      res.send(result);
    } catch (error) {
      res.status(500).send({
        success: false,
        message:
          error.message,
      });
    }
  }
);

// IGNORE REPORTS
app.delete(
  "/api/reports/ignore/:lessonId",
  async (req, res) => {
    try {
      const lessonId =
        req.params.lessonId;

      const result =
        await reportsCollection.deleteMany(
          {
            lessonId,
          }
        );

      res.send(result);
    } catch (error) {
      res.status(500).send({
        success: false,
        message:
          error.message,
      });
    }
  }
);
// GET REPORTS BY LESSON
app.get(
  "/api/reports/:lessonId",
  async (req, res) => {
    try {
      const lessonId =
        req.params.lessonId;

      const reports =
        await reportsCollection
          .find({
            lessonId,
          })
          .sort({
            createdAt: -1,
          })
          .toArray();

      res.send(reports);
    } catch (error) {
      res.status(500).send({
        success: false,
        message:
          error.message,
      });
    }
  }
);

app.get(
  "/api/top-contributors",
  async (req, res) => {
    try {
      const contributors =
        await lessonsCollection
          .aggregate([
            {
              $group: {
                _id: "$creatorEmail",
                totalLessons: {
                  $sum: 1,
                },
              },
            },
            {
              $sort: {
                totalLessons: -1,
              },
            },
            {
              $limit: 6,
            },
          ])
          .toArray();

      const result =
        await Promise.all(
          contributors.map(
            async (
              contributor
            ) => {
              const user =
                await usersCollection.findOne(
                  {
                    email:
                      contributor._id,
                  }
                );

              return {
                name:
                  user?.name,
                image:
                  user?.image,
                email:
                  contributor._id,
                totalLessons:
                  contributor.totalLessons,
                plan:
                  user?.plan,
              };
            }
          )
        );

      res.send(result);
    } catch (error) {
      res.status(500).send({
        success: false,
        message:
          error.message,
      });
    }
  }
);
app.get(
  "/api/most-saved-lessons",
  async (req, res) => {
    try {
      const lessons =
        await lessonsCollection
          .find({
            visibility: "public",
          })
          .sort({
            favoritesCount: -1,
          })
          .limit(6)
          .toArray();

      res.send(lessons);
    } catch (error) {
      res.status(500).send({
        success: false,
        message: error.message,
      });
    }
  }
);













    console.log("Collections Ready");





    // await client.db("admin").command({
    //   ping: 1,
    // });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(
    `Life Lessons Server running on port ${port}`
  );
}); 