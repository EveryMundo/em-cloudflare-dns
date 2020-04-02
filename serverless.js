const { Component } = require("@serverless/core");
const cloudflare = require("cloudflare");

class CloudflareDNS extends Component {
  async default(inputs = {}) {
    const EMAIL = process.env.CF_EMAIL;
    const API_KEY = process.env.CF_KEY;
    const { zone, name, type, content, proxied = true} = inputs;
    this.context.debug(`Starting CloudflareDNS Component.`);
    this.context.debug(`Finding DNS zone`);

    const cf = cloudflare({ email:EMAIL, key:API_KEY });
    const zones = await cf.zones.browse();
    const { id } = zones.result.find( zoneObj => zoneObj.name === zone);
    id && (this.state.zoneId = id);
    
    if (!this.state.zoneId) {
      throw new Error(`"${zone}" not found`);
    }

    const recordName = `${name}.${content}`;
    const records = await cf.dnsRecords.browse(this.state.zoneId, { per_page: 100 });
    const record = records.result.find( record => record.name ===  recordName);    
    this.state.recordId = record && record.id;

    if (!this.state.recordId) {
      this.context.debug(`Creating dns record for : ${recordName}`);
      const record = await cf.dnsRecords.add(this.state.zoneId, {
        name,
        type,
        content,
        proxied      
      });
      record && (this.state.recordId = record.result.id);
    } else {
      const { result } = await cf.dnsRecords.read( this.state.zoneId,this.state.recordId );
      if (result.name === recordName && result.type === type && result.content === content && result.proxied === proxied)
      {
        this.context.debug(`Skipping unchanged DNS record: ${recordName}`);        
      } else {
        this.context.debug(`Updating DNS Record: ${recordName}`);
        await cf.dnsRecords.edit(this.state.zoneId, this.state.recordId, {
          name,
          type,
          content,
          proxied        
        });
      }
      
    }
    await this.save();    
    return { name: name };
  };

  async remove() {
    const EMAIL = process.env.CF_EMAIL;
    const API_KEY = process.env.CF_KEY;
    this.context.debug(`Removing DNS Record`);
    const cf = cloudflare({ email:EMAIL, key:API_KEY });
    if (!this.state.zoneId) {
      throw new Error(`No zone found`);
    }    
    if (!this.state.recordId) {
      throw new Error(`No record found`);
    }

    await cf.dnsRecords.del(this.state.zoneId, this.state.recordId);
    delete this.state.zoneId;
    delete this.state.recordId;
    await this.save();
    return {};
  }
}
module.exports = CloudflareDNS;
