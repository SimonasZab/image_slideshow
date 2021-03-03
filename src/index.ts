import Point2D from 'ts_common_utils/lib/Point2D'
import Timer from 'ts_common_utils/lib/Timer'
import Input from 'ts_common_utils/lib/Input'
import MathUtils from 'ts_common_utils/lib/MathUtils'
import CanvasUtils from 'ts_common_utils/lib/CanvasUtils'
import Common from 'ts_common_utils/lib/Common'
import {AnimationData} from 'ts_common_utils/lib/Common'

/* export class DisplayMode{
	public static readonly ORIGINAL_SIZE:number = 0
	public static readonly FIT_IN_FRAME:number = 1
	public static readonly FILL_FRAME:number = 2
} */

export default class SlideShow{
	private canvas:HTMLCanvasElement
	private ctx:CanvasRenderingContext2D
	private heightToWidthAspectRatio:number

	private clearColor:string
	//private displayMode:number = DisplayMode.FILL_FRAME

	private images:HTMLImageElement[] = []
	private slideShowMode:boolean = true
	private timer:Timer = new Timer(1)
	private slideShowInterval:number = 1
	private prevTouchPos:Point2D = new Point2D(0, 0)
	private touchMoveDelta:number = 0
	private originTouchPos:Point2D = new Point2D(0, 0)
	private swipeXLock:boolean
	private swipeSlide:boolean
	
	private animationData:AnimationData = new AnimationData()
	
	private normalizedPosX:number = 0
	private slidesScrolled:number = 0
	private currentSlideNr:number = 0
	private currentSlideNrInMiddle:number = 0

	private stopRef:() => void = () => this.stop()
	private handleInputMoveRef:(e:MouseEvent | TouchEvent) => void = (e) => this.handleInputMove(e)
	private onResizeRef:() => void = () => this.onResize()

	public init(canvas:HTMLCanvasElement, heightToWidthAspectRatio:number, changeSlideAfterSeconds:number = 1, defaultColor:string='#000000'){
		this.canvas = canvas
		this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D
		this.heightToWidthAspectRatio = heightToWidthAspectRatio
		this.clearColor = defaultColor
		this.slideShowInterval = changeSlideAfterSeconds

		this.onResize()
		window.addEventListener('resize', this.onResizeRef)
	}
	public dispose(){
		this.stopAnimation()
		window.removeEventListener('resize', this.onResizeRef)
	}
	public setSlides(images:HTMLImageElement[]){
		this.images = images
		
		this.onResize()
		
		this.loopSlides()

		this.canvas.addEventListener("mousedown", (e) =>  this.inputStart(e))
		this.canvas.addEventListener("touchstart", (e) =>  this.inputStart(e))
	}
	public getCurrentSlideNrInMiddle(){
		return this.currentSlideNrInMiddle
	}
	public inputStart(e:MouseEvent | TouchEvent){
		this.prevTouchPos = Input.getPointerPosition(e, this.canvas) as Point2D
		this.originTouchPos = this.prevTouchPos
		this.stopAnimation()
		if(e instanceof MouseEvent){
			this.canvas.addEventListener("mouseup", this.stopRef)
			this.canvas.addEventListener("mouseleave", this.stopRef)
			this.canvas.addEventListener("mousemove", this.handleInputMoveRef)
		}else if(e instanceof TouchEvent){
			this.swipeXLock = true
			this.canvas.addEventListener("touchend", this.stopRef)
			this.canvas.addEventListener("touchcancel", this.stopRef)
			this.canvas.addEventListener("touchmove", this.handleInputMoveRef)
		}
	}
	public setCurrentSlide(index:number){
		if(this.currentSlideNrInMiddle == index){
			return
		}
		this.stopAnimation()
		this.moveToSlide(index, MathUtils.interpolation.easeOutExpo)
	}
	private onResize(){
		if(!this.canvas.parentElement){
			return
		}
		
		var bounds = this.canvas.parentElement.getBoundingClientRect()

		this.canvas.width = bounds.width
		this.canvas.height = bounds.width * this.heightToWidthAspectRatio
		this.canvas.style.width = this.canvas.parentElement.clientWidth + 'px'
		this.canvas.style.height = (this.canvas.parentElement.clientWidth * this.heightToWidthAspectRatio) + 'px'
		
		this.setXPos(this.normalizedPosX)
	}
	private stop() {
		this.canvas.removeEventListener("mouseup", this.stopRef)
		this.canvas.removeEventListener("mouseleave", this.stopRef)
		this.canvas.removeEventListener("touchend", this.stopRef)
		this.canvas.removeEventListener("touchcancel", this.stopRef)
		this.canvas.removeEventListener("mousemove", this.handleInputMoveRef)
		this.canvas.removeEventListener("touchmove", this.handleInputMoveRef)
		var advancement = 0
		if (this.swipeSlide) {
			this.swipeSlide = false
			advancement = this.touchMoveDelta > 0 ? -1 : 1
		}
		if(this.slidesScrolled - this.currentSlideNr >= 0.5)
			advancement++
		this.moveToSlide(this.currentSlideNr + advancement, MathUtils.interpolation.easeOutExpo)
	}
	private handleInputMove(e:MouseEvent | TouchEvent) {
		var currPos = Input.getPointerPosition(e, this.canvas) as Point2D
		this.touchMoveDelta = currPos.x - this.prevTouchPos.x
		this.prevTouchPos = currPos

		if(e instanceof MouseEvent){
			if (Math.abs(this.touchMoveDelta) >= 20) {
				this.swipeSlide = true
				this.stop()
				return
			}
		}else if(e instanceof TouchEvent){
			if (Math.abs(this.touchMoveDelta) >= 20) {
				this.swipeSlide = true
	
				this.stopAnimation()
	
				this.stop()
				return
			}
	
			if(MathUtils.dist1D(this.originTouchPos.x, currPos.x) <= 20){
				return
			}else if(this.swipeXLock){
				if(MathUtils.dist1D(this.originTouchPos.y, currPos.y) > 20){
					this.stop()
					return
				}
	
				this.stopAnimation()
				this.swipeXLock = false
			}
		}
		this.setXPos(this.normalizedPosX - this.touchMoveDelta / (this.canvas.width * this.images.length))
	}
	private stopAnimation(){
		this.slideShowMode = false
		this.animationData.stop()
	}
	private loopSlides(){
		if (!this.slideShowMode)
			return
		setTimeout(
			() => {
				if (!this.slideShowMode)
					return
				this.moveToSlide(
					this.currentSlideNr + 1,
					MathUtils.interpolation.easeInOutSine,
					() => this.loopSlides()
				)
			},
			this.slideShowInterval * 1000
		)
	}
	private moveToSlide(slideNr:number, interpolationFunc:(n: number) => number, endCallback:(() => void) | null = null){
		var startX = this.normalizedPosX

		var _this = this
		this.timer.reset()

		function step(dt:number){
			var progress = _this.timer.update(dt)
			var currX = MathUtils.lerp(startX, slideNr / _this.images.length, interpolationFunc(progress))
			_this.setXPos(currX)

			if (_this.timer.ended) {
				if (endCallback)
					endCallback()
				return true
			}
			return false
		}
		Common.framedAnimation(step, this.animationData)
	}
	private setXPos(x:number = this.normalizedPosX){
		if(this.images.length == 0){
			return
		}

		this.normalizedPosX = MathUtils.loopValueInRange2(x, 0, 1)
		this.slidesScrolled = this.normalizedPosX * this.images.length
		this.currentSlideNr = Math.floor(this.slidesScrolled)
		this.currentSlideNrInMiddle = (this.currentSlideNr + ((this.slidesScrolled - this.currentSlideNr) >= 0.5 ? 1 : 0)) % this.images.length
		this.draw()
	}
	private draw(){
		CanvasUtils.clearColor(this.ctx, this.clearColor)

		if(this.images.length == 0){
			return
		}

		var posX = (this.slidesScrolled - this.currentSlideNr) * -this.canvas.width
		this.drawSlide(this.currentSlideNr, posX)
		if(this.slidesScrolled != this.currentSlideNr){
			var nextSlideNr = (this.currentSlideNr + 1) % this.images.length
			this.drawSlide(nextSlideNr, posX + this.canvas.width)
		}
		/* for(var i = 0;i < this.images.length;i++){
			this.ctx.drawImage(this.images[i], this.pos + (i * this.canvas.width), 0)
			this.ctx.strokeRect(this.pos + (i * this.canvas.width), 0, this.canvas.width, this.canvas.height)
		} */
	}
	private drawSlide(slideNr:number, pos:number){
		var scale = 1
		this.ctx.save()

		/* if(this.displayMode == DisplayMode.FIT_IN_FRAME){
			scale = MathUtils.getScaleToFitBox(this.images[slideNr].width, this.images[slideNr].height, this.canvas.width, this.canvas.height)
		} else if(this.displayMode == DisplayMode.FILL_FRAME){
			scale = MathUtils.getScaleToFillBox(this.images[slideNr].width, this.images[slideNr].height, this.canvas.width, this.canvas.height)
			var path = new Path2D()
			path.rect(pos, 0, this.canvas.width, this.canvas.height)
			this.ctx.clip(path)
		}
		var imgW = this.images[slideNr].width * scale
		var imgH = this.images[slideNr].height * scale

		this.ctx.drawImage(
			this.images[slideNr],
			pos + (this.canvas.width / 2 - imgW / 2),
			this.canvas.height / 2 - imgH / 2,
			imgW,
			imgH
		) */
		//if(this.displayMode == DisplayMode.FILL_FRAME){
		scale = MathUtils.getScaleToFillBox(this.images[slideNr].width, this.images[slideNr].height, this.canvas.width, this.canvas.height)
		var imgW = this.images[slideNr].width * scale
		var imgH = this.images[slideNr].height * scale

		this.ctx.drawImage(
			this.images[slideNr],
			pos,
			this.canvas.height / 2 - imgH / 2,
			imgW,
			imgH
		)
		//}
		this.ctx.restore()

		//this.ctx.strokeRect(pos, 0, this.canvas.width, this.canvas.height)
	}
}