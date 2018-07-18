// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const _ = require('lodash');
const path = require('path');
const os = require('os');
const swagger = require('../lib/swagger.json');
const pkg = require('../package.json');
const file = require('./file.js');
const string = require('./string.js');
const qw = string.qw;
const assign = Object.assign;

const prop_by_type = (def, type)=>_.toPairs(def.properties)
    .filter(p=>p[1].type==type).map(p=>p[0]);

const conf = {
    version: pkg.version,
    is_win: process.platform == 'win32',
    work_dir: path.resolve(os.homedir(), 'luminati_proxy_manager'),
    is_electron: process.versions && !!process.versions.electron,
    proxy_fields: assign({}, swagger.definitions.proxy.properties,
        swagger.definitions.manager.properties),
    mgr_fields: _.keys(swagger.definitions.manager.properties),
    numeric_fields: prop_by_type(swagger.definitions.proxy, 'integer'),
    boolean_fields: prop_by_type(swagger.definitions.proxy, 'boolean'),
    credential_fields: qw`customer zone password token`,
    default_superproxy_domain: 'zproxy.lum-superproxy.io',
    default_rule: {res: [{action: {req_status_cnt: true,
        req_status_success: true, retry: false}, head: true, status:
        {arg: '([23]..|404)', type: '=~'}}, {action: {req_status_cnt: true,
        req_status_success: false, retry: false}, head: true, status:
        {arg: '([23]..|404)', type: '!~'}}], url: '**', tag: 'req_status'},
};
conf.default_fields = [].concat(conf.credential_fields, conf.mgr_fields);
conf.proxy_params = _(swagger.definitions.proxy.properties).pickBy(
    k=>!conf.credential_fields.includes(k)).keys().value();
conf.luminati_default = {
    port: 24000,
    iface: '0.0.0.0',
    customer: process.env.LUMINATI_CUSTOMER,
    password: process.env.LUMINATI_PASSWORD,
    zone: process.env.LUMINATI_ZONE||'static',
    log: 'error',
    proxy: conf.default_superproxy_domain,
    proxy_port: 22225,
    proxy_count: 1,
    allow_proxy_auth: true,
    pool_type: 'sequential',
    sticky_ip: false,
    insecure: false,
    secure_proxy: false,
    short_username: false,
    ssl: false,
    whitelist_ips: [],
    test_url: 'http://lumtest.com/myip.json',
    disable_color: false,
    proxy_retry: 2,
    proxy_switch: 2,
    api: 'https://luminati-china.io',
};
conf.manager_default = assign({}, _.omit(conf.luminati_default, 'port'), {
    max_requests: 50,
    pool_size: 3,
    proxy_switch: 5,
    www: 22999,
    www_whitelist_ips: [],
    ws: 22998,
    config: path.resolve(os.homedir(),
        '.luminati.json'.substr(conf.is_win ? 1 : 0)),
    database: path.resolve(os.homedir(),
        '.luminati.sqlite3'.substr(conf.is_win ? 1 : 0)),
    cookie: path.resolve(os.homedir(),
        '.luminati.jar'.substr(conf.is_win ? 1 : 0)),
    mode: 'root',
    dropin: true,
    dropin_port: 22225,
    no_usage_stats: false,
    request_stats: true,
    request_stats_limit: 1000,
    history: false,
    logs: false,
    reverse_lookup_dns: false,
    proxy_creds_check: true,
    beta_features: false,
    rules: {post: [conf.default_rule]},
    use_proxy_cache: true,
});

try { file.mkdirp_e(conf.work_dir); }
catch(e){ conf.work_dir = path.resolve(os.homedir()); }

assign(module.exports, conf);
