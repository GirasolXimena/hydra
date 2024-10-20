import p5 from 'p5'

export default class P5 extends p5 {
  width: number;
  height: number;
  mode: p5.RENDERER;
  canvas: HTMLCanvasElement;
  constructor({
    width = window.innerWidth,
    height = window.innerHeight,
    mode = 'p2d'
  }: {
    width?: number;
    height?: number;
    mode?: p5.RENDERER
  } = {}) {
    //console.log('createing canvas', width, height, window.innerWidth, window.innerHeight)
    const hydraUI = document.createElement('canvas')
    super((p: p5) => {
      p.setup = () => { p.createCanvas(width, height, mode, hydraUI) }
      //    p.setup = () => { p.createCanvas() }
      p.draw = () => { }
    }, hydraUI)
    this.width = width
    this.height = height
    this.mode = mode
    this.canvas = hydraUI
    this.canvas.style.position = "absolute"
    this.canvas.style.top = "0px"
    this.canvas.style.left = "0px"
    this.canvas.style.zIndex = "-1"
    // console.log('p5', this)
    //  return this.p5
  }

  show() {
    this.canvas.style.visibility = "visible"
  }

  hide() {
    this.canvas.style.visibility = "hidden"
  }

  // p5 clear function not covering canvas
  clear() {
    this.drawingContext.clearRect(0, 0, this.canvas.width, this.canvas.height)
    return this;
  }
}

