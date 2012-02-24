/**
 * @depends jquery.min.js
 * @depends backbone-min.js
 * @depends jquery.jqplot.min.js
 * @depends jquery.maskedinput.min.js
 */
$(function() {

	window.MetricModel = Backbone.Model.extend({
		defaults: {
			increasing: '',
			decreasing: '',
			type: '',
			toNumeric: function(value){return parseInt(value);},
			fromNumeric: function(value){return parseInt(value);},
			example: "",
			label: ''
		}
	});

	window.MetricsCollection = Backbone.Collection.extend({
		model: MetricModel,

		find_by_type: function(find_type){
			return _(this.filter(function(data){
				return data.get('type') == find_type;
			})[0])._wrapped
		}
	});

	window.WorkoutModel = Backbone.Model.extend({
		defaults: {
			metric_type: '',
			title: ''
		},
		entries: function(){
			return entries.find_by_workout_id(this.get('id'));
		},

		metric: function() {
			return 	metrics.find_by_type(this.get('metric_type'));
		},

		average: function(){
			var total = 0;
			var workout_metric = this.metric();
			var value = this.get('value');
			var workout_entries = this.entries();
			workout_entries.each(function(entry){
				var value = entry.get('value');
				total += workout_metric.attributes.toNumeric(value);
			});
			return Math.round(total / workout_entries._wrapped.length);
		},

		compare: function(first, second){
			var metric = this.metric();
			var first_numeric = metric.attributes.toNumeric(first);
			var second_numeric = metric.attributes.toNumeric(second);
			var change = (second_numeric - first_numeric);
			if (change > 0) {
				var percent_change = Math.round(100 - (second_numeric/first_numeric) * 100.0) *-1 + '% ' + metric.get('increasing');
			} else {
				var percent_change = Math.round(100 - (second_numeric/first_numeric) * 100.0) + '% ' + metric.get('decreasing');
			};
			if (change < 0) { change *= -1};
			return {change: metric.attributes.fromNumeric(change), percent_change: percent_change}
		}
	});

	window.WorkoutsCollection = Backbone.Collection.extend({
		model: WorkoutModel,
		localStorage: new Store('workouts')
	});

	window.EntryModel = Backbone.Model.extend({
		defaults:{
			workout_id: '',
			metric_type: '',
			value: '',
			date: new Date()
		}
	});

	window.EntryCollection = Backbone.Collection.extend({
		model: EntryModel,
		localStorage: new Store('entries'),
		find_by_workout_id: function(workout_id) {
			return _(this.filter(function(data){
				return data.get('workout_id') == workout_id;
			}))
		}
	});

	window.WorkoutView = Backbone.View.extend({
		tagName: 'div',
		className: 'workout row',
		template: _.template($('#workout-template').html()),

		events: {
			'keypress input': "enter_pressed",
			'click button': "new_entry",
			'focus input': 'set_default',
			'click .delete-entry': 'delete_entry',
			'click .delete-workout': 'delete_workout'
		},

		initialize: function() {
			this.bind('new-entry', function(){this.draw_graph(); this.update_info();}, this);
			this.render();
		},

		render: function(){
			$(this.el).html(this.template(this.model));
			$('#workouts').append(this.el);
			$('.time').mask("99:99:99",{placeholder:'0'});
			this.draw_graph();
			this.update_info();
			return this;
		},

		delete_workout: function(e){
			if (confirm("Are you sure you want to delete this workout and it's entries?")) {
				$('#'+ this.model.get('id')).parent().remove();
				this.model.destroy();
			};
			return false;
		},

		delete_entry: function(e){
			if (confirm("Are you sure you want to delete this entry?")) {
				var entry_id = $(e.target).attr('data-id');
				var entry = entries.get(entry_id);
				entry.destroy();
				$('#entry-'+ entry_id).remove();
				this.update_info();
				this.draw_graph();
			};
			return false;
		},

		enter_pressed: function(e){
			if (e.keyCode == 13) {
				this.new_entry();
			};	
		},

		new_entry: function(e) {
			var input = this.$('input');
			var text = input.val();
			var entry = entries.create({value: text, workout_id: this.model.get('id')});
			input.val(this.model.metric().get('example'));
			input.blur();
			this.$('tbody').append('<tr id="entry-'+ entry.get('id') +'"><td>'+ new Date().toDateString() +'</td><td>'+text+'</td><td><a href="#" class="delete-entry" data-id="'+entry.get('id') +'">X</a></td></tr>');
			this.$('table').show();
			this.$('.no-entries').hide();
			this.trigger('new-entry');
		},

		set_default: function(){
			this.$('input').val(this.model.metric().get('example'));
		},

		update_info: function() {
			if (this.model.entries()._wrapped.length > 1) {
				var template = _.template($('#workout-info-template').html());
				this.$('#info-'+ this.model.id).html(template(this.model));
				this.$('#info-'+ this.model.id).show();
			};
		},

		draw_graph: function() {
			if (this.model.entries()._wrapped.length > 1) {
				var graph_id = "graph-"+ this.model.get('id');
				$('#'+graph_id).show().html('');
				var entries = this.model.entries();
				var metric = this.model.metric();
				var line = []
				entries.each(function(entry){
					line.push(metric.attributes.toNumeric(entry.get('value')))
				});
				
				var graph = $.jqplot(graph_id, [line], {
					axes:{xaxis:{tickOptions:{formatString:' '}},
						yaxis:{tickOptions:{formatString:' '}}},
						grid:{background:'#f0f0f0'}
				});
			};
		}
	});

	window.NewWorkoutView = Backbone.View.extend({
		el: $('#app'),
		template: _.template($('#new-workout-template').html()),
		events: {
			"submit #new-workout-form": "create_workout"	
		},

		render: function(){
			$(this.el).html(this.template(window.metrics));
			return this;
		},

		create_workout: function(){
			var _title = this.$('#new-workout-form input[name="title"]').val();
			var _metric_type = this.$('#new-workout-form select[name="metric_type"]').val();
			var _workout = workouts.create({title: _title, metric_type: _metric_type});
			$(this.el).html();
			router.navigate("/", true);
			return false;
		}
	});

	window.AppView = Backbone.View.extend({
		el: $('#app'),
		template: _.template($('#app-template').html()),

		initialize: function(){
			window.workouts = new WorkoutsCollection();
			window.entries = new EntryCollection()
			workouts.fetch();
			entries.fetch();

			//Seed the metric data as it isn't persisted
			window.metrics = new MetricsCollection([
				{
					type: 'Time',
					increasing: 'slower',
					decreasing: 'faster',
					toNumeric: function(value){
						var split = value.split(/:|\./);
						var seconds = parseInt(split[2]);
						var minutes = parseInt(split[1]) * 60;
						var hours = parseInt(split[0]) * 60;
						isNaN(seconds)? seconds = 0 : seconds = seconds;
						isNaN(minutes)? minutes = 0 : minutes = minutes;
						isNaN(hours)? hours = 0 : hours = hours;
						return seconds + minutes + hours;
					},
					fromNumeric: function(value){
						var hours = parseInt(value/3600);
						var minutes = parseInt((value - hours*3600)/60);
						var seconds = value - (hours*3600) - (minutes * 60);
						var toString = [];
						_.each([hours, minutes, seconds], function(v){
							if (v < 10) {toString.push('0' + v)} else {toString.push(v)};
						});
						return toString[0] + ":" + toString[1] + ':' + toString[2];
					},
					example: '00:00:00'
				},
				{
					type: 'Weight (lbs)',
					increasing: 'heavier',
					decreasing: 'lighter',
					label: "lbs"						},
				{
					type: 'Weight (kg)',
					increasing: 'heavier',
					decreasing: 'lighter',
					label: "kg"
				},
				{
					type: 'Repetitions',
					increasing: 'more',
					decreasing: 'less',
					label: "reps"
				}
			]);
		},

		render: function(){
			this.el.html(this.template());
			workouts.each(function(this_workout){
				new WorkoutView({model: this_workout})
			});
			return this;
		},

		addOne: function(workout) {
			new WorkoutView({model: workout});
		}
	});

	window.Router = Backbone.Router.extend({
		routes: {
			"": "home",
			"/": "home",
			"/new-workout": "new_workout",
			"/clear-storage": "clear_storage"
		},

		home: function(query, page){
			window.app.render();	
		},

		new_workout: function(query, page){
			if (window.new_workout) {
				window.new_workout.render();
			} else { new_workout = new NewWorkoutView(); window.new_workout.render();};
		},

		clear_storage: function(query, page){
			//Clear out yo storage
			if (workouts.length) {
				workouts.each(function(_workout){
					if (confirm("Do you want to remove this workout?\n" + _workout.attributes)) {
						_workout.destroy();
					};
				});
			};

			if (entries.length) {
				entries.each(function(_entry){
					if (confirm("Do you want to remove this entry?\n" + _entry.attributes)) {
						_entry.destroy();
					};
				});
			};
			this.navigate("/", true)
		}
	});

	window.app = new AppView();

	window.router = new Router();
	Backbone.history.start();
})

if(navigator.standalone === undefined || !!navigator.standalone) {
	window.applicationCache.addEventListener('updateready', function(){
			window.applicationCache.swapCache();
	}, false);

	if (navigator.userAgent.match(/Android/i)) {
		window.addEventListener("load", function() { window.scrollTo(0,1); }, false);
	}
}