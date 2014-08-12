@color: {{base_color}};
@color1: spin(@color, 80);
@color2: spin(@color, 70);
@color3: spin(@color, 60);
@color4: spin(@color, 50);
@color5: spin(@color, 40);
@color6: spin(@color, 30);
@color7: spin(@color, 20);
@color8: spin(@color, 10);
@color9: spin(@color, 0);

#{{resource_id}} {
    marker-fill: @color1;
    marker-opacity: 1;
    marker-width: {{marker_size}}-1;
    marker-placement: point;
    marker-type: ellipse;
    marker-line-width: 1.0;
    marker-line-color: white;
    marker-allow-overlap: true;
    [count > 5] { marker-fill: @color2; }
    [count > 10] { marker-fill: @color3; }
    [count > 15] { marker-fill: @color4; }
    [count > 20] { marker-fill: @color5; }
    [count > 25] { marker-fill: @color6; }
    [count > 30] { marker-fill: @color7; }
    [count > 35] { marker-fill: @color8; }
    [count > 40] { marker-fill: @color9; }
}
