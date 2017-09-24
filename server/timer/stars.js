const cheerio = require('cheerio');
const fs = require('fs');

const helper = require('../helper');
const config = require('../config/config');
const sqlQuery = require('../config/mysql-async');

// 根据网站api得到相应的url和参数
const reqUrl = 'https://github.com/search';
const filter = ' stars:>500';
const reqParams = {
    "l": "TypeScript",
    "o": "desc",
    "p": 1,
    "q": "TypeScript" + filter,
    "s": "stars",
    "type": "Repositories",
    "utf8": "✓"
};

async function mostStars(type) {
    reqParams.l = type;
    reqParams.q = type + filter;
    
    let starsData = [];
    let pageIndex = 1;
    while (pageIndex <= config.timer.pageTotal) {
        let result = await getStarsData(pageIndex, starsData.length);
        if (result.success === true) {
            if (result.data.length === 0) {
                pageIndex = config.timer.pageTotal + 1;
            } else {
                pageIndex++;
                starsData.push(...result.data);
            }
        }
    }

    let delResult = await sqlQuery(`delete from stars_rank where type = '${type}'`);
    let sql = 'INSERT INTO stars_rank (projectname, introduction, topics, updatetime, stars, ordernum, type) VALUES';
    for (let {
            projectname,
            introduction,
            topics,
            updatetime,
            stars,
            ordernum
        } of Object.values(starsData)) {
        sql += `('${projectname}', '${introduction}', '${topics}', '${updatetime}', '${stars}', ${ordernum}, '${type}'), `;
    }
    sql = sql.substring(0, sql.length - 2);
    let sqlResult = await sqlQuery(sql)
    console.log(type, sqlResult);
}

async function getStarsData(pageIndex, currentOrder) {
    reqParams.p = pageIndex;
    let result = '';
    try {
        result = await helper.fetch_data_get(reqUrl, reqParams);
    } catch (err) {
        console.log('获取链接失败：', err);
        return {
            success: false,
            data: null
        };
    }
    // 根据页面结构获取所需数据
    let $ = cheerio.load(result.text);
    let data = [];
    $('.repo-list-item').each((idx, el) => {
        let _this = $(el);
        let $topics = _this.find('.topics-row-container a');
        let arrTopic = [];
        $topics.each((index, elem) => {
            arrTopic.push($(elem).text().trim());
        })
        data.push({
            projectname: _this.find('h3 a.v-align-middle').text(),
            introduction: _this.find('p.col-9.d-inline-block').text().trim().replace(/\'/g, '\\\'').replace(/\?/g, ''),
            topics: arrTopic.join(','),
            updatetime: _this.find('p relative-time').attr('datetime'),
            stars: _this.find('a.muted-link').text().trim(),
            ordernum: ++currentOrder
        });
    })
    return {
        success: true,
        data: data
    };
}

exports.mostStars = mostStars;