var   _             = require('underscore')
    , sys           = require('util')
    , th            = require('../support/test_helper.js')
    , assert        = require('assert')
    , grainstore    = require('grainstore')
    , RenderCache   = require('../../lib/render_cache.js')
    , serverOptions = require('../support/server_options')
    , tests         = module.exports = {};


function getDefaults(params) {

    if(!params.table)
        params.table = "test_table";
        
    var def_style_point = " {marker-fill: #FF6600;marker-opacity: 1;marker-width: 16;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}";		
    var def_style_line = " {line-color:#FF6600; line-width:1; line-opacity: 0.7;}";		
    var def_style_poly = " {polygon-fill:#FF6600; polygon-opacity: 0.7; line-opacity:1; line-color: #FFFFFF;}";		
    
    var default_style = _.template(	
        '#<%= table %>[mapnik-geometry-type=1]' + def_style_point +		
        '#<%= table %>[mapnik-geometry-type=2]' + def_style_line +		
        '#<%= table %>[mapnik-geometry-type=3]' + def_style_poly);

    var default_sql = _.template("<%= table %>");
    
    return {
        dbtype: serverOptions.dbtype,
        dbname: 'windwalker_test',
        table: params.table,
        style: default_style(params),
        sql: default_sql(params),
        x: 4,
        y:4,
        z:4,
        geom_type:'polygon',
        format:'png'
    }
}

suite('render_cache', function() {

	// initialize core mml_store
	var mml_store  = new grainstore.MMLStore(serverOptions.grainstore);
	var mml_store  = new grainstore.MMLStore(serverOptions.grainstore);


    test('true', function(done) {
        assert.equal(global.environment.name, 'test');
        done();
    });

    test('render_cache has a cached of render objects', function(done){
        var render_cache = new RenderCache(1000, mml_store);
        assert.ok(_.isObject(render_cache.renderers));
        done();
    });

    test('render_cache can create a unique key from request, stripping xyz/callback', function(done){
        var render_cache = new RenderCache(1000, mml_store);
        var req = {params:{sql:"select *", geom_type:'point'}};
         _.defaults(req.params, getDefaults(req.params));
        delete req.params.style;
        
        assert.equal(render_cache.createKey(req.params), 'windwalker_test:test_table:png:point:select *::');
        done();
    });

    /**
     * THE FOLLOWING TESTS NEED SOME DB SETUP
     * They need a database setup as below with the table test_table defined
     */

    test('render_cache can generate a tilelive object', function(done){
        var render_cache = new RenderCache(1000, mml_store);
        
         var req = {params:{}};
         _.defaults(req.params, getDefaults(req.params));

        render_cache.getRenderer(req, function(err, renderer){
            assert.ok(renderer, err);
            assert.equal(renderer._uri.query.base.split(':')[0], 'windwalker_test');
            done();
        });
    });


    test('render_cache can generate > 1 tilelive object', function(done){
        var render_cache = new RenderCache(1000, mml_store);
        var req = {params: { }};
        _.defaults(req.params, getDefaults(req.params));
        
        render_cache.getRenderer(req, function(err, renderer){
            assert.ok(renderer, err);
            req = {params: {table: 'test_table_2' }};
            _.defaults(req.params, getDefaults(req.params));
            render_cache.getRenderer(req, function(err, renderer2){
                assert.equal(_.keys(render_cache.renderers).length, 2);
                done();
            });
        });
    });


    test('render_cache can reuse tilelive object', function(done){
        var render_cache = new RenderCache(1000, mml_store);
        var req = {params: {}};
        _.defaults(req.params, getDefaults(req.params));
        
        render_cache.getRenderer(req, function(err, renderer){
            assert.ok(renderer, err);
            render_cache.getRenderer(req, function(err, renderer){
                assert.equal(_.keys(render_cache.renderers).length, 1);
                done();
            });
        });
    });

    test('render_cache can delete all tilelive objects when reset', function(done){
        var render_cache = new RenderCache(1000, mml_store);

        var req = {params: { }};
        _.defaults(req.params, getDefaults(req.params));
        
        render_cache.getRenderer(req, function(err, renderer){
            assert.ok(renderer, err);
            var req = {params: { sql: "(SELECT * FROM test_table) as q" }};
            _.defaults(req.params, getDefaults(req.params));
            render_cache.getRenderer(req, function(err, renderer){
                assert.equal(_.keys(render_cache.renderers).length, 2);

                render_cache.reset(req);

                assert.equal(_.keys(render_cache.renderers).length, 0);
                done();
            });
        });
    });


    test('render_cache can delete only related tilelive objects when reset', function(done){
        var render_cache = new RenderCache(1000, mml_store);

        var req = {params: { }};
        _.defaults(req.params, getDefaults(req.params));
        

        render_cache.getRenderer(req, function(err, renderer){
            assert.ok(renderer, err);
            req.params.sql = "(SELECT * FROM test_table) as q";
            render_cache.getRenderer(req, function(err, renderer){
				assert.ok(renderer, err);
                req.params.sql = "(SELECT * FROM test_table) as q2";
                req.params.table = 'test_table_2';

                render_cache.getRenderer(req, function(err, renderer){
					assert.ok(renderer, err);
                    assert.equal(_.keys(render_cache.renderers).length, 3);

                    req.params.table = 'test_table';
                    render_cache.reset(req);

                    assert.equal(_.keys(render_cache.renderers).length, 1);
                    done();
                });
            });
        });
    });


    test('render_cache can purge all tilelive objects', function(done){
        var render_cache = new RenderCache(1000, mml_store);

        var req = {params: { }};
        _.defaults(req.params, getDefaults(req.params));
        

        render_cache.getRenderer(req, function(err, renderer){
            assert.ok(renderer, err);
            req.params.sql = "(SELECT * FROM test_table) as q";

            render_cache.getRenderer(req, function(err, renderer){
            req.params.sql = "(SELECT * FROM test_table) as q2";
                req.params.table = 'test_table_2';

                render_cache.getRenderer(req, function(err, renderer){
                    assert.equal(_.keys(render_cache.renderers).length, 3);

                    req.params.table = 'test_table';
                    render_cache.purge();

                    assert.equal(_.keys(render_cache.renderers).length, 0);
                    done();
                });
            });
        });
    });

    test('render_cache automatically deletes tilelive only after timeout', function(done){
        var render_cache = new RenderCache(5, mml_store);
        var req = {params: { }};
        _.defaults(req.params, getDefaults(req.params));
        

        render_cache.getRenderer(req, function(err, renderer){
            assert.ok(renderer, err);
            assert.equal(_.keys(render_cache.renderers).length, 1);
            setTimeout(function(){assert.equal(_.keys(render_cache.renderers).length, 0); done();},10);
        });
    });

});

