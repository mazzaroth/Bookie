/*jslint eqeqeq: false, browser: true, debug: true, onevar: true,
         plusplus: false, newcap: false, */
/*global _: false, window: false, self: false, escape: false, */
YUI.add('bookie-view', function (Y) {
    var _ = Y.Lang.substitute,
        ns = Y.namespace('bookie');

    ns.BmarkView = Y.Base.create('bookie-bmark-view', Y.View, [], {
        container_html: '<div class="bmark"/>',

        _get_template: function () {
            return Y.one('#bmark_row').get('text');
        },

        events: {
            '.delete': {
                click: 'remove'
            }
        },

        initializer: function (cfg) {
            this.cTemplate = Y.Handlebars.compile(this._get_template());
        },

        /**
         * Handle the remove event on this bookmark
         *
         */
        remove: function () {
            var that = this;
            this.get('model').remove();

            this.get('container').transition({
                easing: 'ease',
                duration: 0.4,
                opacity: 0
            }, function () {
                that.destroy();
            });
        },

        render: function () {
            // Render this view's HTML into the container element.
            var tpl_data = this.get('model').getAttrs();
            tpl_data.owner = this.get('current_user') == this.get('model').get('username');

            return this.get('container').set(
                'innerHTML',
                this.cTemplate(tpl_data)
            );
        }
    }, {
        ATTRS: {
            /**
             * The view is for a url of a specific user
             *
             * Say /admin/bmarks for the admin bookmarks, does not mean I'm
             * the admin
             *
             */
            resource_user: {
            },

            /**
             * The currently authorized user
             *
             */
            current_user: {
            },

            container: {
                valueFn: function () {
                    var container = Y.Node.create(this.container_html);
                    container.set(
                        'data-bid',
                        this.get('model').get('bid')
                    );
                    return container;
                }

            }
        }
    });


    ns.PagerView = Y.Base.create('bookie-pager-view', Y.View, [], {
        container_html: '<div class="pager"/>',

        _get_templates: function () {
            return {
                prev: Y.one('#previous_control').get('text'),
                next: Y.one('#next_control').get('text')
            }
        },

        events: {
            '.previous': {
                click: 'previous_page'
            },
            '.next': {
                click: 'next_page'
            }
        },

        initializer: function (cfg) {
            var tpl = this._get_templates();
            this.cPrevTemplate = Y.Handlebars.compile(tpl.prev);
            this.cNextTemplate = Y.Handlebars.compile(tpl.next);
        },

        previous_page: function (e) {
            e.preventDefault();
            Y.fire(this.get('previous_event'));
        },

        next_page: function (e) {
            e.preventDefault();
            Y.fire(this.get('next_event'));
        },

        render: function () {
            // Render this view's HTML into the container element.
            return this.get('container').set(
                'innerHTML',
                this.cPrevTemplate() + this.cNextTemplate()
            );
        }

    }, {
        ATTRS: {
            container: {
                valueFn: function () {
                    return Y.Node.create(this.container_html);
                }

            },

            id: {
                value: 'pager'
            },

            previous_event: {
                readOnly: true,
                valueFn: function () {
                    return this.get('id') + ':previous';
                }
            },

            next_event: {
                readOnly: true,
                valueFn: function () {
                    return this.get('id') + ':next';
                }
            }
        }

    });


    ns.BmarkListView = Y.Base.create('bookie-list-view', Y.View, [], {
        container_html: '<div class="bmark_list"/>',
        _get_template: function () {
            return Y.one('#bmark_list').get('text');
        },

        events: {},

        /**
         * Prepare and add the pager view for our control
         *
         * We need two, one for the top and one for the bottom
         *
         */
        _init_pager: function () {
            this.pagers = [
                new Y.bookie.PagerView(),
                new Y.bookie.PagerView(),
            ];

            // bind the pager event
            Y.on('pager:next', this._next_page, this);
            Y.on('pager:previous', this._prev_page, this);
        },

        /**
         * Setup the api call for filling in our data based on our config
         *
         */
        _init_api: function () {
            // then there's a user in our resource path, make the api call a
            // UserBmarksAll vs BmarksAll
            if (this.get('resource_user')) {
                this.api = new Y.bookie.Api.route.UserBmarksAll(
                    this.get('api_cfg')
                );
            } else {
                this.api = new Y.bookie.Api.route.BmarksAll(
                    this.get('api_cfg')
                );
            }
        },

        /*
         * Fetch a dataset based on our current data
         *
         */
        _fetch_dataset: function () {
            var that = this,
                pager = this.get('pager');

            // make sure we update the api paging information with the latest
            // from our pager

            this.api.data.count = pager.get('count');
            this.api.data.page = pager.get('page');
            this.api.data.with_content = pager.get('with_content');

            this.api.call({
                'success': function (data, request) {
                    var data_node = Y.one('.data_list'),
                        new_nodes = new Y.NodeList();

                    // build models out of our data
                    that.models = new Y.bookie.BmarkList();

                    that.models.add(Y.Array.map(
                        data.bmarks, function (bmark){
                            var b = new Y.bookie.Bmark(bmark),
                                n = new Y.bookie.BmarkView({
                                    model: b,
                                    current_user: that.get('current_user'),
                                    resource_user: that.get('resource_user')
                                    }
                                );

                            b.api_cfg = that.get('api_cfg');

                            new_nodes.push(n.render())
                            return b;
                        })
                    );

                    // now set the html
                    data_node.setContent(new_nodes);
               }
           });
        },

        _next_page: function (e) {

            this.get('pager').next();

            // now that we've incremented the page let's fetch a new set of
            // results
            this._fetch_dataset();
        },

        _prev_page: function (e) {
            var p = this.get('pager'),
                old_page = p.get('page');

            p.previous();

            // only update the view if we did change pages (e.g. not on page
            // 1 already)
            if (old_page != p.get('page')) {
                // now that we've incremented the page let's fetch a new set of
                // results
                this._fetch_dataset();
            }
        },

        /**
         * Need to make some updates to the ui based on the current page
         *
         */
        _update_ui: function () {

        },

       initializer: function (cfg) {
           this.cTemplate = Y.Handlebars.compile(this._get_template());
           this._init_pager();
           this._init_api();
       },

       render: function () {
           var that = this,
               // Render this view's HTML into the container element.
               html = this.get('container').set(
                   'innerHTML',
                   this.cTemplate(this.getAttrs())
               );

           // start the request for our models
           this._fetch_dataset();

           html.all('.paging').each(function (n) {
               var p = that.pagers.pop();
               n.appendChild(p.render());
           });

           return html;
       }

    }, {
        ATTRS: {
            container: {
                valueFn: function() {
                    return Y.Node.create(this.container_html);
                }
            },

            api_cfg: {

            },

            pager: {
                valueFn: function () {
                    return new Y.bookie.PagerModel();
                }
            },

            /**
             * Who is the currently auth'd user
             *
             */
            current_user: {

            },

            /**
             * What is the user that owns this collection
             *
             * e.g. /admin/bmarks == admin user even though I'm not logged in
             * as admin
             */
            resource_user: {

            },

        }

    });

    ns.AccountView = Y.Base.create('bookie-account-view', Y.View, [], {
        _blet_visible: false,
        _api_visibile: false,

        _bind_buttons: function () {
            Y.one('#show_key').on(
                'click',
                this._show_api_key,
                this
            );
            Y.one('#show_bookmarklet').on(
                'click',
                this._show_bookmarklet,
                this
            );
        },

        _show_api_key: function (e) {
            var key_div = Y.one('#api_key'),
                key_container = Y.one('#api_key_container');

            e.preventDefault();

            // if the api key is showing and they click this, hide it
            if(this._api_visible) {
                key_container.hide(true);
                this._api_visible = false;
            } else {
                var api = new Y.bookie.Api.route.UserApiKey(this.get('api_cfg'));
                this._api_visible = true;
                // make an ajax request to get the api key for this user and then
                // show it in the container for it
                api.call({
                    success: function (data, request) {
                        key_div.setContent(data.api_key);
                        key_container.show(true);
                    }

                });
            }
        },

        _show_bookmarklet: function (e) {
            var blet = Y.one('#bookmarklet_text');
            e.preventDefault();

            // if the api key is showing and they click this, hide it
            // the opacity must start out at 0 for the transition to take
            // effect
            if(this._blet_visible) {
                this._blet_visible = false;
                blet.hide(true);
            } else {
                this._blet_visible = true;
                blet.show(true);
            }
        },

        initializer: function (cfg) {
            this._bind_buttons();
        }

    }, {
        ATTRS: {
            api_cfg: {
                required: true
            }
        }
    });


}, '0.1.0', { requires: ['base', 'view', 'bookie-model', 'bookie-api', 'handlebars', 'transition'] });
