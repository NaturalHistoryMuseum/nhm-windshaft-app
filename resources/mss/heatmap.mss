@size: {{marker_size}};
#{{resource_id}} {
    marker-file: url('{{marker_url}}');
    marker-allow-overlap: true;
    marker-opacity: {{intensity}};
    marker-width: @size;
    marker-height: @size;
    marker-clip: false;
    image-filters: colorize-alpha({{gradient}});
    opacity: 0.8;
    comp-op: multiply;
}
