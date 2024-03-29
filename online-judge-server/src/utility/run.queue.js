const Bull = require("bull");
const { runBatch } = require("./judge0");

const createQueue = () => {
  try {
    return new Bull("run", {
      redis: {
        host: process.env.redisHost || "127.0.0.1",
        port: process.env.redisPort,
      },
    });
  } catch (err) {
    console.log("[run.queue.js: createQueue] Error: " + err);
  }
};

const runQueue = createQueue();

var list = [];

var timeOut;

// this function will create a timeout promise and store the value in timeOut variable
function startTimeOut() {
  timeOut = setTimeout(() => {
    if (list.length) {
      runBatch(list);
      list = [];
    }
  }, 3000);
}

// Redis Consumer : Executing after Producer adds data to queue
const runProcess = async (job) => {
  // first clear the timeout that is running

  clearTimeout(timeOut);

  // Push data to array list
  list.push(job.data);

  // If list length is n then send for Batch Run (Judge0)
  if (list.length == 20) {
    runBatch(list);
    list = [];
  } else {
    // start the timeout again for next 10 seconds
    startTimeOut();
  }
};

runQueue.process(runProcess);

module.exports = { runQueue };
