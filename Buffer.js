// buffer

var Buffer = function(default_maxSize, default_minSize) {
  this.maxSize = (default_maxSize != undefined)?default_maxSize:10;
  this.minSize = (default_minSize != undefined)?default_minSize:1;
  this.arr = [];
  this.curIndex = -1;
}
Buffer.prototype.pushItem = function(re, cb) {
  this.curIndex++;
  if (this.curIndex >= this.maxSize) {
    this.curIndex = 0;
  }
  this.arr[this.curIndex] = re;
  var c = this.arr.length;
  if (cb != null && c >= this.minSize) {
    for (var i = 0; i < c; i++) {
      cb(this.arr[i], c);
    }
  }
}
Buffer.prototype.lastItem = function(cb) {
  var c = this.arr.length;
  if (cb != null && c > 0 && this.curIndex != -1 && c >= this.minSize) {
    cb(this.arr[this.curIndex], c);
  }
}
Buffer.prototype.reset = function() {
  this.arr = [];
  this.curIndex = -1;
}
Buffer.prototype.getSize = function() {
  return this.arr.length;
}
