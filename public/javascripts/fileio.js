var client = null;
 
function uploadFile()
{
    var files = document.getElementById("file").files;
    var formData = new FormData();
    client = new XMLHttpRequest();
 
    var prog = document.getElementById("progress");
 
    if(!files.length)
        return;
 
    prog.value = 0;
    prog.max = 1;
    formData.append(files);
 
    client.onerror = function(e) {
      alert(e);
    };
 
    client.onload = function(e) {
      prog.value = prog.max;
    };

    client.upload.onprogress = function(e) {
      document.getElementById("progress").value = e.loaded/e.total;            
    };
 
    client.onabort = function(e) {
      alert("Upload canceled")
      document.getElementById("progress").value = 0
    };
 
    client.open("POST", "");
    client.send(formData);
}

function uploadAbort() {
  if(client instanceof XMLHttpRequest)
      client.abort();
}

function setCookie(key, value) {
  var cookie = key+'='+JSON.stringify(value)
  document.cookie = cookie
}

function getCookie(key) {
  var result = document.cookie.match(new RegExp(key+'=([^;]+)'));
  result && (result = JSON.parse(result[1]));
  return result
}
