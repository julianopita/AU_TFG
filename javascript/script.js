$(document).ready(function() {
    $('#mobile_btn').on('click', function() {
        $('#mobile_menu').toggleClass('active');
        $('#mobile_btn').find('i').toggleClass('fa-x');
    });    
    });

 function toggleContent(elementId, caretId) {
      const content = document.getElementById(elementId);
      content.style.display = content.style.display === 'flex' ? 'none' : 'flex';
      const caret = document.getElementById(caretId);
      caret.classList.toggle("rotated");
    } 