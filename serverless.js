const { Component } = require("@serverless/core");
const cloudflare = require("cloudflare");

class CloudflareDNS extends Component {
  async default({
    email = process.env.CF_EMAIL,
    key = process.env.CF_KEY,
    zoneId = process.env.CF_ZONE_ID,
    zone,
    name,
    type,
    content,
    proxied = true
   
  } = {}) {
    this.context.debug(`Starting CloudflareDNS Component.`);
    this.context.debug(`Finding DNS zone`);
    const cf = cloudflare({ email, key });
    this.state.zoneId = zoneId;
    if (!this.state.zoneId) {
      const zones = await cf.zones.browse();
      const zone = zones.result.find(zone => zone.name === zone);
      zone && (this.state.zoneId = zone.id);
    }

    if (!this.state.zoneId) {
      throw new Error(`"${zone}" not found`);
    }

    if (!this.state.recordId) {
      const records = await cf.dnsRecords.browse(this.state.zoneId);
      const record = records.result.find(record => record.name === name);    
      record && (this.state.recordId = record.id);
    }

    if (!this.state.recordId) {
      this.context.debug(`Creating DNS Record: ${name}`);
      const record = await cf.dnsRecords.add(this.state.zoneId, {
        name,
        type,
        content,
        proxied      
      });
      record && (this.state.recordId = record.result.id);
    } else {
      const { result } = await cf.dnsRecords.read(
        this.state.zoneId,
        this.state.recordId
      );
      if (result.name === name && result.type === type && result.content === content && result.proxied === proxied)
      {
        this.context.debug(`Skipping unchanged DNS record: ${name}`);
      } else {
        this.context.debug(`Updating DNS Record: ${name}`);
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
  }

  async remove({
    email = process.env.CF_EMAIL,
    key = process.env.CF_KEY,
    zoneId = process.env.CF_ZONE_ID,
    zone,
    name
  } = {}) {
    this.context.debug(`Removing DNS Record: ${name}`);
    const cf = cloudflare({ email, key });
    this.state.zoneId = zoneId;
    if (!this.state.zoneId) {
      const zones = await cf.zones.browse();
      const zone = zones.result.find(zone => zone.name === zone);
      this.state.zoneId = zone.id;
    }
    if (!this.state.zoneId) {
      throw new Error(`No zone named "${zone}" found`);
    }

    if (!this.state.recordId) {
      const records = await cf.dnsRecords.browse(this.state.zoneId);
      const record = records.result.find(record => record.name === name);
      record && (this.state.recordId = record.id);
    }
    if (!this.state.recordId) {
      throw new Error(`No record "${name}" found`);
    }

    await cf.dnsRecords.del(this.state.zoneId, this.state.recordId);
    delete this.state.zoneId;
    delete this.state.recordId;
    await this.save();
    return {};
  }
}
module.exports = CloudflareDNS;