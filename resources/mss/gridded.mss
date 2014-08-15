@color1: #FFFF00;
@color2: #FFAA00;
@color3: #FF6600;
@color4: #FF0000;

#{{resource_id}} {
    marker-width: {{marker_size}}-1;
    marker-placement: point;
    marker-type: ellipse;
    marker-allow-overlap: true;

    marker-line-width: 1.0;
    marker-opacity: 0.75;

    marker-fill: @color1;
    marker-line-color: @color1;
    [count > 5] {
      marker-fill: @color2;
      marker-line-color: @color2;
    }
    [count > 20] {
      marker-fill: @color3;
      marker-line-color: @color3;
    }
    [count > 50] {
      marker-fill: @color4;
      marker-line-color: @color4;
    }
}
