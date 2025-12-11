// Fix: Commented out reference to vite/client as the type definition is missing in the environment
// /// <reference types="vite/client" />

declare module '*?worker' {
  class ViteWorker extends Worker {
    constructor();
  }
  export default ViteWorker;
}

declare module '*?worker&inline' {
  class ViteWorker extends Worker {
    constructor();
  }
  export default ViteWorker;
}