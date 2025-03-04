export default class GravityPass{

    constructor(gravityPipeline, gravityBindGroup, workgroupCount){
        this.gravityPipeline = gravityPipeline;
        this.gravityBindGroup = gravityBindGroup;
        this.workgroupCount = workgroupCount;
    }

    setPass(commandEncoder){
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(this.gravityPipeline);
      pass.setBindGroup(0, this.gravityBindGroup);
      pass.dispatchWorkgroups(this.workgroupCount);
      pass.end();
    }
}