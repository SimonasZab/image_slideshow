# Image slideshow
Responsive canvas image slideshow compatible with any JS framework.
## Features
- Resizes canvas to parent div width;
- Slide change at set interval;
- Smooth slide change with mouse/touch input;
- Chnage to desired slide with custom buttons.

## Usage
[![npm install svg-path-bounds](https://nodei.co/npm/image_slideshow.png?mini=true)](https://npmjs.org/package/image_slideshow/)

```html
<div>
    <canvas id='slideshow_canvas'/>
</div>
```

```js
import ImageSlideshow from 'image_slideshow'

let image_slideshow = new ImageSlideshow()
image_slideshow.init(document.getElementById("slideshow_canvas"), 10/16, 10)//image slideshow canvas, height to width ratio of canvas, slide change interval in seconds

let images = []
//load images and pass them to slideshow (HTMLImageElement)
image_slideshow.setSlides(images)
```