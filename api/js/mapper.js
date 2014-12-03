var config       = require('./config');
var _            = require('underscore');
var locations    = require('./locations.json');
var paths        = require('./paths.json');
var zones        = require('./zones.json');
var locationsObj = {};

var mapper = {

};

var navigate = function(startNode, destinationNode) {
  var directions = [];
  
  /*
    A Heuristic to measure the distance from one 
    node to another that are in the same zone.
  */
  var distanceToNode = function(node, otherNode) {
    var xDelta = (node.xCoord-otherNode.xCoord);
    var yDelta = (node.yCoord-otherNode.yCoord);
    return Math.sqrt((xDelta*xDelta) + (yDelta*yDelta));
  }
  
  /*
    A Heuristic to measure the distance between 2
    nodes in different zones.
  */
  var distanceToOtherZoneNode = function(node, goal) {
    var zoneBorder = zones[node.zone][goal.zone].borderCoordinates;
    var goalBorder = zones[goal.zone][node.zone].borderCoordinates;
    var zoneToZoneDistance = zones[goal.zone][node.zone].travelTime;
    var distanceToGoal = (node, goalBorder);
    return distanceToBorder + distanceToGoal;
  }
  
  var edgeHeuristic = function(edgeId, goal){
    var node = locationsObj[edgeId];
    if(node.zone === goal.zone) {
      return distanceToNode(node, goal);
    } else {
      return distanceToOtherZoneNode(node, goal);
    }
  }
  
  function search(node, goal, i) {
    console.log("Searching " + i);
    if(i>100) {
      return;
    }
    var lowestScore;
    var bestNode;
    node.edges.forEach(function(edgeId) {
      console.log("Checking node " + edgeId);
      var heuristicTravelTime = edgeHeuristic(edgeId, goal);
      var actualTravelTime = node.paths[edgeId].travelTime 
        || distanceToNode(node, locationsObj[edgeId]);
      var edgeScore = heuristicTravelTime + actualTravelTime;
      if(!lowestScore || edgeScore < lowestScore) {
        lowestScore = edgeScore;
        bestNode = edgeId;
      }
    });
    if (bestNode) {
      directions.push(node.paths[bestNode])
      if(bestNode == goal.id) {
        console.log("FOUND GOAL")
        return;
      } else {
        console.log(bestNode + " != " + goal.id)
        i++;
        return search(locationsObj[bestNode], goal, i);
      }
    }
  }
  
  search(startNode, destinationNode, 0);
  return directions;
}


mapper.init = function(callback) {
  locations.forEach(function(location) {
    if(locationsObj[location.id]) {
      return callback("Duplicate Location ID: " + location.id);
    } else {
      locationsObj[location.id] = location;
      locationsObj[location.id].edges = [];
      locationsObj[location.id].paths = {};
    }
  });
  
  paths.forEach(function(path) {
    if(!locationsObj[path.lambdaNode] || !locationsObj[path.sigmaNode]) {
      return callback("Invalid Path location ID: " + path);
    }
    
    if(path.lambdaNode === path.sigmaNode) {
      return callback("Path cannot lead to itself: " + path);
    }
    
    if (!path.travelTime || !(typeof path.travelTime === 'number')) {
      return callback("Invalid or missing travel time: " + path);
    }
    
    if(locationsObj[path.lambdaNode].edges[path.sigmaNode]) {
      return callback("Duplicate Path: " + path);
    }
    
    if(locationsObj[path.sigmaNode].edges[path.lambdaNode]) {
      return callback("Duplicate Path: " + path);
    }
    
    locationsObj[path.lambdaNode].edges.push([path.sigmaNode]);
    locationsObj[path.lambdaNode].paths[path.sigmaNode] = path;
    
    locationsObj[path.sigmaNode].edges.push(path.lambdaNode);
    locationsObj[path.sigmaNode].paths[path.lambdaNode] = path;
  });

  return callback();
};

mapper.getLocations = function(req, res, next) {
  return res.send(locations);
}

mapper.getLocation = function(req, res, next) {
  if(!req.params.id) {
    return res.send(400);
  }
  
  if(locationsObj[req.params.id]) {
    return res.send(200, locationsObj[req.params.id]);
  } else {
    return res.send(404);
  }
}

mapper.getRoute = function(req, res, next) {
  var startNodeId = req.params.id;
  var endNodeId = req.params.destination;
  
  if(!startNodeId || !endNodeId) {
    return res.send(400, "Missing Start/End Node ID");
  }
  if(!locationsObj[startNodeId]) {
    return res.send(400, "Invalid Start Node ID");
  };
  if(!locationsObj[endNodeId]) {
    return res.send(400, "Invalid End Node ID");
  };
  
  var startNode = locationsObj[startNodeId];
  var endNode = locationsObj[endNodeId];
  var directions = navigate(startNode, endNode);
  return res.send(200, directions);
};

module.exports = mapper;