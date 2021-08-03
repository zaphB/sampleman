function setCookie(key, value) {
  document.cookie = key+'="'+value+'"'
}

function getCookie(key) {
  regex = new RegExp(key+'="([^;]+)"', 'g')
  while (true) {
    m = regex.exec(document.cookie)
    if (!m) {
      break
    }
    result = m[1]
  }
  return result
}

function showNavbar() {
  setCookie('navbar-status', 'shown')

  samples = document.getElementById('samples')
  samples.style.minWidth = '300px'
  samples.style.width = 'auto'

  navbar = document.getElementsByClassName('navbar')[0]
  a = document.getElementById('toggle-navbar')
  a.innerHTML = '[hide]'
  a.parentNode.style.textAlign = 'right'
  navbar.style.width = 'auto'
  navbar.style.minWidth = '300px'
  navbar.firstChild.style.width = 'auto'

  imgs = document.getElementsByClassName('imagetile')
  for(var i=0; i<imgs.length; i++){
    imgs[i].style.maxWidth = '250px'
  }
}

function hideNavbar() {
  setCookie('navbar-status','hidden')

  samples = document.getElementById('samples')
  samples.style.minWidth = '150px'
  samples.style.width = '150px'

  navbar = document.getElementsByClassName('navbar')[0]
  a = document.getElementById('toggle-navbar')
  a.innerHTML = '[show]'
  a.parentNode.style.textAlign = 'left'
  navbar.style.width = '40px'
  navbar.style.minWidth = '40px'
  navbar.style.overflowX = 'scroll'
  navbar.firstChild.style.width = '750px'

  imgs = document.getElementsByClassName('imagetile')
  for(var i=0; i<imgs.length; i++){
    imgs[i].style.maxWidth = '400px'
  }
}

function toggleNavbar() {
  a=document.getElementById('toggle-navbar')
  if(a.innerHTML == '[show]'){
    showNavbar()
  }
  else{
    hideNavbar()
  }
}

function showImg(isExtraWide) {
  setCookie('img-status', 'shown')
  a = document.getElementById('toggle-img')
  a.innerHTML = '[labbook]'
  navbar = document.getElementsByClassName('navbar')[0]
  if(isExtraWide) {
    navbar.style.maxWidth = '450px'
  }
  document.getElementById('labbook').style.display = 'none'
  document.getElementById('images').style.display = 'block'
}

function hideImg() {
  setCookie('img-status', 'hidden')
  a = document.getElementById('toggle-img')
  a.innerHTML = '[imgs]'
  document.getElementsByClassName('navbar')[0].style.maxWidth = '700px'
  document.getElementById('labbook').style.display = 'block'
  document.getElementById('images').style.display = 'none'
}


function toggleImg(isExtraWide) {
  a = document.getElementById('toggle-img')
  if(a.innerHTML == '[imgs]') {
    showImg(isExtraWide)
  }
  else {
    hideImg()
    showNavbar()
  }
}
