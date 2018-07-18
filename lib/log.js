// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const zerr = require('../util/zerr.js');
const sprintf = require('../util/sprintf.js');
const date = require('../util/date.js');
const os = require('os');
const rfs = require('rotating-file-stream');
const E = module.exports = logger;

E.log_file = process.env.LPM_LOG_FILE||'luminati.log';
E.log_dir = process.env.LPM_LOG_DIR||os.homedir();
E.lpm_debug_filters = process.env.LPM_DEBUG||null;
zerr.log = E._log = [];
E._log.max_size = 200;
const zerr_flush = zerr.flush;
const zerr_zexit = zerr.zexit;

const stdio_transport = (conf = {})=>{
    if (conf.buffer)
        zerr.set_log_buffer(1);
    else
        zerr.set_log_buffer(0);
    return {
        logger: (level, msg)=>{
            if (conf.filter && !conf.filter(msg, level))
                return;
            E._log.push(msg);
            if (E._log.length > E._log.max_size)
                E._log.splice(0, Math.ceil(E._log.length-E._log.max_size/2));
            if ({EMERG: 1, ALERT: 1, CRIT: 2, ERR: 3}[zerr.LINV[level]])
                return console.error(msg);
            console.log(msg);
        }
    };
};

let log_file_stream;
const file_transport = ()=>{
    if (!E.log_file || !E.log_dir)
        throw new Error('log directory and file must be defined');
    if (!log_file_stream)
    {
        log_file_stream = rfs(E.log_file, {path: E.log_dir, size: '300M',
            rotate: 10, compress: true});
    }
    return {
        logger: (level, msg)=>log_file_stream.write(msg+'\n'),
        zexit: ()=>{
            console.log('fileexit');
            log_file_stream.end();
        },
    };
};

const apply_transports = (fn, transports, ...args)=>{
    transports = transports||[];
    transports.forEach(t=>t[fn]&&t[fn].apply(t, args));
};

const create_log_formatter = ()=>{
    const msg_tpl = `${zerr.prefix}%s %s: %s`;
    const level_names = Object.keys(zerr.L);
    const hide_timestamp = zerr.hide_timestamp;
    return (level, msg)=>{
        let d = hide_timestamp ? '' : date.to_sql_ms();
        return sprintf(msg_tpl, d, level_names[level], msg);
    };
};

const create_zerr_logger = (id, transports = [])=>{
    const fmtr = create_log_formatter(id);
    return (level, msg)=>{
        apply_transports('logger', transports, level, fmtr(level, msg));
    };
};

const create_zexit_handler = transports=>()=>{
    apply_transports('zexit', transports);
    zerr_zexit();
};

const create_flush_handler = transports=>()=>{
    apply_transports('flush', transports);
    zerr_flush();
};

const destroy_logger = lgr=>{
    apply_transports('destroy', lgr.transports);
};

const create_debug_filter = filters=>{
    if (!filters)
        return null;
    filters = filters.split(',').map(f=>new RegExp(f));
    return (msg, level)=>{
        if (zerr.LINV[level] != 'DEBUG')
            return true;
        for (let f of filters)
        {
            if (f.test(msg))
                return true;
        }
        return false;
    };
};

const create_log_iface = (id, transports)=>{
    const id_prefix = '%s'+(id ? ' ' : '');
    const lgr = ['info', 'notice', 'warn', 'error', 'debug', 'crit']
    .reduce((log, l)=>{
        let zfn = l=='error' ? 'err' : l;
        log[l] = (...args)=>{
            let params = args.slice(1);
            args = params.length ? [id_prefix+args[0], id].concat(params) :
                [id_prefix+'%s', id, args[0]];
            zerr[zfn].apply(zerr, args);
        };
        return log;
    }, {});
    lgr.transports = transports;
    lgr.destroy = ()=>destroy_logger(lgr);
    return lgr;
};

function logger(id, conf){
    let level = typeof conf == 'object' ? conf.level : conf||'';
    level = level.toUpperCase();
    if (level=='ERR')
        level = 'ERROR';
    if (level=='NONE')
        level = 'CRIT';
    let buffer = E.log_level[level.toLowerCase()]>E.log_level.warn;
    const transports = [stdio_transport({buffer, filter: create_debug_filter(
        E.lpm_debug_filters)}), file_transport()];
    zerr.flush = create_flush_handler(transports);
    zerr.zexit = create_zexit_handler(transports);
    zerr.set_logger(create_zerr_logger(id, transports));
    zerr.set_level(level);
    return create_log_iface(id, transports);
}

E.log_level = {none: -1, error: 0, warn: 1, info: 2, notice: 3, verbose: 4,
    debug: 5};
