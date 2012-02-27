# Requires the Ruby gem Juicer
juicer merge -i javascripts/jquery.min.js javascripts/jquery.jqplot.min.js javascripts/maskedinput.min.js javascripts.backbone-min.js -o javascripts/dep.min.js
juicer merge -i -f -s stylesheets/jquery.jqplot.css stylesheets/layout.css stylesheets/skeleton.css stylesheets/base.css -o stylesheets/dep.min.css
